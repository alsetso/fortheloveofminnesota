'use client';

import { useState, useEffect, useMemo } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/types/supabase';

interface Contract {
  id: string;
  contract_id: string;
  agency: string | null;
  payee: string;
  contract_type: string;
  start_date: string;
  end_date: string | null;
  total_contract_amount: number;
}

interface PayrollRecord {
  id: string;
  employee_name: string | null;
  agency_name: string | null;
  job_title: string | null;
  total_wages: number;
}

interface PaymentRecord {
  id: string;
  budget_period: number;
  agency: string | null;
  payee: string | null;
  payment_amount: number;
}

interface BudgetRecord {
  id: string;
  budget_period: number;
  agency: string | null;
  fund: string | null;
  program: string | null;
  budget_amount: number;
  spend_amount: number;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return dateStr;
  }
}

export default function BuildingTransparencyTab() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [payroll, setPayroll] = useState<PayrollRecord[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [budgets, setBudgets] = useState<BudgetRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const supabase = useMemo(() => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Missing Supabase environment variables');
    }
    return createBrowserClient<Database>(supabaseUrl, supabaseAnonKey);
  }, []);

  useEffect(() => {
    async function fetchData() {
      try {
        // Fetch Contracts (first 10)
        const { data: contractsData } = await supabase
          .from('contracts')
          .select('id, contract_id, agency, payee, contract_type, start_date, end_date, total_contract_amount')
          .order('total_contract_amount', { ascending: false })
          .limit(10);

        // Fetch Payroll (first 10)
        const { data: payrollData } = await supabase
          .from('payroll')
          .select('id, employee_name, agency_name, job_title, total_wages')
          .order('total_wages', { ascending: false })
          .limit(10);

        // Fetch Payments (first 10)
        const { data: paymentsData } = await supabase
          .from('payments')
          .select('id, budget_period, agency, payee, payment_amount')
          .order('payment_amount', { ascending: false })
          .limit(10);

        // Fetch Budgets (first 10)
        const { data: budgetsData } = await supabase
          .from('budgets')
          .select('id, budget_period, agency, fund, program, budget_amount, spend_amount')
          .order('budget_amount', { ascending: false })
          .limit(10);

        setContracts((contractsData as Contract[]) || []);
        setPayroll((payrollData as PayrollRecord[]) || []);
        setPayments((paymentsData as PaymentRecord[]) || []);
        setBudgets((budgetsData as BudgetRecord[]) || []);
      } catch (error) {
        console.error('[BuildingTransparencyTab] Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [supabase]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Contracts Section */}
      <div className="bg-white border border-gray-200 rounded-md">
        <div className="p-[10px] border-b border-gray-200">
          <h2 className="text-sm font-semibold text-gray-900">Contracts</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="p-[10px] text-left text-xs font-medium text-gray-500 border-r border-gray-200">Agency</th>
                <th className="p-[10px] text-left text-xs font-medium text-gray-500 border-r border-gray-200">Payee</th>
                <th className="p-[10px] text-left text-xs font-medium text-gray-500 border-r border-gray-200">Type</th>
                <th className="p-[10px] text-left text-xs font-medium text-gray-500 border-r border-gray-200">Start Date</th>
                <th className="p-[10px] text-right text-xs font-medium text-gray-500">Amount</th>
              </tr>
            </thead>
            <tbody>
              {contracts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-[10px] text-xs text-gray-500 text-center">
                    No contracts found
                  </td>
                </tr>
              ) : (
                contracts.map((contract) => (
                  <tr key={contract.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="p-[10px] text-xs text-gray-600 border-r border-gray-100">
                      {contract.agency || '—'}
                    </td>
                    <td className="p-[10px] text-xs text-gray-600 border-r border-gray-100">
                      {contract.payee}
                    </td>
                    <td className="p-[10px] text-xs text-gray-600 border-r border-gray-100">
                      {contract.contract_type}
                    </td>
                    <td className="p-[10px] text-xs text-gray-600 border-r border-gray-100">
                      {formatDate(contract.start_date)}
                    </td>
                    <td className="p-[10px] text-right text-xs text-gray-900 font-medium">
                      {formatCurrency(contract.total_contract_amount)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payroll Section */}
      <div className="bg-white border border-gray-200 rounded-md">
        <div className="p-[10px] border-b border-gray-200">
          <h2 className="text-sm font-semibold text-gray-900">Payroll</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="p-[10px] text-left text-xs font-medium text-gray-500 border-r border-gray-200">Employee</th>
                <th className="p-[10px] text-left text-xs font-medium text-gray-500 border-r border-gray-200">Agency</th>
                <th className="p-[10px] text-left text-xs font-medium text-gray-500 border-r border-gray-200">Job Title</th>
                <th className="p-[10px] text-right text-xs font-medium text-gray-500">Total Wages</th>
              </tr>
            </thead>
            <tbody>
              {payroll.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-[10px] text-xs text-gray-500 text-center">
                    No payroll records found
                  </td>
                </tr>
              ) : (
                payroll.map((record) => (
                  <tr key={record.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="p-[10px] text-xs text-gray-600 border-r border-gray-100">
                      {record.employee_name || '—'}
                    </td>
                    <td className="p-[10px] text-xs text-gray-600 border-r border-gray-100">
                      {record.agency_name || '—'}
                    </td>
                    <td className="p-[10px] text-xs text-gray-600 border-r border-gray-100">
                      {record.job_title || '—'}
                    </td>
                    <td className="p-[10px] text-right text-xs text-gray-900 font-medium">
                      {formatCurrency(record.total_wages)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payments Section */}
      <div className="bg-white border border-gray-200 rounded-md">
        <div className="p-[10px] border-b border-gray-200">
          <h2 className="text-sm font-semibold text-gray-900">Payments</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="p-[10px] text-left text-xs font-medium text-gray-500 border-r border-gray-200">Period</th>
                <th className="p-[10px] text-left text-xs font-medium text-gray-500 border-r border-gray-200">Agency</th>
                <th className="p-[10px] text-left text-xs font-medium text-gray-500 border-r border-gray-200">Payee</th>
                <th className="p-[10px] text-right text-xs font-medium text-gray-500">Amount</th>
              </tr>
            </thead>
            <tbody>
              {payments.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-[10px] text-xs text-gray-500 text-center">
                    No payment records found
                  </td>
                </tr>
              ) : (
                payments.map((record) => (
                  <tr key={record.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="p-[10px] text-xs text-gray-600 border-r border-gray-100">
                      {record.budget_period}
                    </td>
                    <td className="p-[10px] text-xs text-gray-600 border-r border-gray-100">
                      {record.agency || '—'}
                    </td>
                    <td className="p-[10px] text-xs text-gray-600 border-r border-gray-100">
                      {record.payee || '—'}
                    </td>
                    <td className="p-[10px] text-right text-xs text-gray-900 font-medium">
                      {formatCurrency(record.payment_amount)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Budget Section */}
      <div className="bg-white border border-gray-200 rounded-md">
        <div className="p-[10px] border-b border-gray-200">
          <h2 className="text-sm font-semibold text-gray-900">Budget</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="p-[10px] text-left text-xs font-medium text-gray-500 border-r border-gray-200">Period</th>
                <th className="p-[10px] text-left text-xs font-medium text-gray-500 border-r border-gray-200">Agency</th>
                <th className="p-[10px] text-left text-xs font-medium text-gray-500 border-r border-gray-200">Fund</th>
                <th className="p-[10px] text-left text-xs font-medium text-gray-500 border-r border-gray-200">Program</th>
                <th className="p-[10px] text-right text-xs font-medium text-gray-500 border-r border-gray-200">Budget</th>
                <th className="p-[10px] text-right text-xs font-medium text-gray-500">Spent</th>
              </tr>
            </thead>
            <tbody>
              {budgets.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-[10px] text-xs text-gray-500 text-center">
                    No budget records found
                  </td>
                </tr>
              ) : (
                budgets.map((record) => (
                  <tr key={record.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="p-[10px] text-xs text-gray-600 border-r border-gray-100">
                      {record.budget_period}
                    </td>
                    <td className="p-[10px] text-xs text-gray-600 border-r border-gray-100">
                      {record.agency || '—'}
                    </td>
                    <td className="p-[10px] text-xs text-gray-600 border-r border-gray-100">
                      {record.fund || '—'}
                    </td>
                    <td className="p-[10px] text-xs text-gray-600 border-r border-gray-100">
                      {record.program || '—'}
                    </td>
                    <td className="p-[10px] text-right text-xs text-gray-900 font-medium border-r border-gray-100">
                      {formatCurrency(record.budget_amount)}
                    </td>
                    <td className="p-[10px] text-right text-xs text-gray-900 font-medium">
                      {formatCurrency(record.spend_amount)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

