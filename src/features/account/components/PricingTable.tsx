'use client';

import { ArrowLeftIcon } from '@heroicons/react/24/outline';

interface PricingTableProps {
  onBack: () => void;
}

export default function PricingTable({ onBack }: PricingTableProps) {
  return (
    <div className="space-y-3">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-gray-900 transition-colors mb-2"
      >
        <ArrowLeftIcon className="w-3 h-3" />
        Back to Billing
      </button>
      <div className="bg-white border border-gray-200 rounded-md p-[10px]">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Plans & Pricing</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2 px-2 font-semibold text-gray-900">Name</th>
                <th className="text-center py-2 px-2 font-semibold text-gray-900">Hobby</th>
                <th className="text-center py-2 px-2 font-semibold text-gray-900">Pro</th>
                <th className="text-center py-2 px-2 font-semibold text-gray-900">Pro+</th>
              </tr>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2 px-2 font-medium text-gray-700">Price</th>
                <td className="text-center py-2 px-2 text-gray-600">$0</td>
                <td className="text-center py-2 px-2 text-gray-600">$20</td>
                <td className="text-center py-2 px-2 text-gray-600">$80</td>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-100">
                <td colSpan={4} className="py-2 px-2 font-medium text-gray-900 bg-gray-50">Hobby</td>
              </tr>
              <tr className="border-b border-gray-100">
                <td className="py-2 px-2 text-gray-600">Public Pins</td>
                <td className="text-center py-2 px-2 text-gray-900">✔️</td>
                <td className="text-center py-2 px-2 text-gray-900">✔️</td>
                <td className="text-center py-2 px-2 text-gray-900">✔️</td>
              </tr>
              <tr className="border-b border-gray-100">
                <td className="py-2 px-2 text-gray-600">Private pins</td>
                <td className="text-center py-2 px-2 text-gray-900">✔️</td>
                <td className="text-center py-2 px-2 text-gray-900">✔️</td>
                <td className="text-center py-2 px-2 text-gray-900">✔️</td>
              </tr>
              <tr className="border-b border-gray-100">
                <td colSpan={4} className="py-2 px-2 font-medium text-gray-900 bg-gray-50">Pro</td>
              </tr>
              <tr className="border-b border-gray-100">
                <td className="py-2 px-2 text-gray-600">Shareable Profile</td>
                <td className="text-center py-2 px-2 text-gray-500">❌</td>
                <td className="text-center py-2 px-2 text-gray-900">✔️</td>
                <td className="text-center py-2 px-2 text-gray-900">✔️</td>
              </tr>
              <tr className="border-b border-gray-100">
                <td className="py-2 px-2 text-gray-600">Pin collections view</td>
                <td className="text-center py-2 px-2 text-gray-500">❌</td>
                <td className="text-center py-2 px-2 text-gray-900">✔️</td>
                <td className="text-center py-2 px-2 text-gray-900">✔️</td>
              </tr>
              <tr className="border-b border-gray-100">
                <td className="py-2 px-2 text-gray-600">See who viewed your profile and pins</td>
                <td className="text-center py-2 px-2 text-gray-500">❌</td>
                <td className="text-center py-2 px-2 text-gray-900">✔️</td>
                <td className="text-center py-2 px-2 text-gray-900">✔️</td>
              </tr>
              <tr className="border-b border-gray-100">
                <td className="py-2 px-2 text-gray-600">API: OpenAI</td>
                <td className="text-center py-2 px-2 text-gray-500">❌</td>
                <td className="text-center py-2 px-2 text-gray-900">✔️</td>
                <td className="text-center py-2 px-2 text-gray-900">✔️</td>
              </tr>
              <tr className="border-b border-gray-100">
                <td colSpan={4} className="py-2 px-2 font-medium text-gray-900 bg-gray-50">Pro+</td>
              </tr>
              <tr className="border-b border-gray-100">
                <td className="py-2 px-2 text-gray-600">API: Skip Trace</td>
                <td className="text-center py-2 px-2 text-gray-500">❌</td>
                <td className="text-center py-2 px-2 text-gray-500">❌</td>
                <td className="text-center py-2 px-2 text-gray-900">✔️</td>
              </tr>
              <tr>
                <td className="py-2 px-2 text-gray-600">API: Zillow</td>
                <td className="text-center py-2 px-2 text-gray-500">❌</td>
                <td className="text-center py-2 px-2 text-gray-500">❌</td>
                <td className="text-center py-2 px-2 text-gray-900">✔️</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

