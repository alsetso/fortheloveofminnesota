import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseServer';
import * as XLSX from 'xlsx';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { createErrorResponse, createSuccessResponse } from '@/lib/server/apiError';
import { withSecurity, REQUEST_SIZE_LIMITS } from '@/lib/security/middleware';
import { validateRequestBody } from '@/lib/security/validation';
import { z } from 'zod';

const payrollImportSchema = z.object({
  fiscal_year: z.string().regex(/^\d{4}$/).transform(Number).pipe(z.number().int().min(2020).max(2025)),
});

const BATCH_SIZE = 1000;

// Helper functions to match Python script logic
function parseInteger(value: any): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') {
    const int = Math.floor(value);
    return isNaN(int) ? null : int;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed || trimmed === '-') return null;
    const parsed = parseFloat(trimmed);
    return isNaN(parsed) ? null : Math.floor(parsed);
  }
  return null;
}

function parseFloatValue(value: any): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') {
    return isNaN(value) ? null : value;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed || trimmed === '-') return null;
    const parsed = parseFloat(trimmed);
    return isNaN(parsed) ? null : parsed;
  }
  return null;
}

function parseText(value: any): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') {
    const str = String(value).trim();
    return str || null;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed && trimmed !== '-' ? trimmed : null;
  }
  return null;
}

function parseLastHireDate(value: any): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') {
    return String(Math.floor(value));
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '-' || !trimmed) return null;
    try {
      return String(Math.floor(parseFloat(trimmed)));
    } catch {
      return trimmed || null;
    }
  }
  return null;
}

function findSheetByPattern(workbook: XLSX.WorkBook, pattern: string): string | null {
  const lowerPattern = pattern.toLowerCase();
  for (const sheetName of workbook.SheetNames) {
    if (sheetName.toLowerCase().includes(lowerPattern)) {
      return sheetName;
    }
  }
  return null;
}

function getActiveColumnName(workbook: XLSX.WorkBook, fiscalYear: number): string | null {
  const hrSheetName = findSheetByPattern(workbook, 'HR INFO');
  if (!hrSheetName) return null;

  const hrSheet = workbook.Sheets[hrSheetName];
  const range = XLSX.utils.decode_range(hrSheet['!ref'] || 'A1');
  const headerRow: any[] = [];
  
  for (let col = 0; col <= range.e.c; col++) {
    const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
    const cell = hrSheet[cellAddress];
    if (cell && cell.v) {
      const headerValue = String(cell.v).toUpperCase();
      if (headerValue.includes('ACTIVE_ON_JUNE_30')) {
        return cell.v as string;
      }
    }
  }
  return null;
}

function parseHRRow(row: any[], headers: string[], activeColName: string | null): any | null {
  try {
    const data: Record<string, any> = {};
    headers.forEach((header, i) => {
      data[header] = i < row.length ? row[i] : null;
    });

    const temporaryId = parseText(data['TEMPORARY_ID']);
    if (!temporaryId) return null;

    return {
      temporary_id: temporaryId,
      record_nbr: parseInteger(data['RECORD_NBR']),
      employee_name: parseText(data['EMPLOYEE_NAME']),
      agency_nbr: parseText(data['AGENCY_NBR']),
      agency_name: parseText(data['AGENCY_NAME']),
      department_nbr: parseText(data['DEPARTMENT_NBR']),
      department_name: parseText(data['DEPARTMENT_NAME']),
      branch_code: parseText(data['BRANCH_CODE']),
      branch_name: parseText(data['BRANCH_NAME']),
      job_code: parseText(data['JOB_CODE']),
      job_title: parseText(data['JOB_TITLE']),
      location_nbr: parseText(data['LOCATION_NBR']),
      location_name: parseText(data['LOCATION_NAME']),
      location_county_name: parseText(data['LOCATION_COUNTY_NAME']),
      reg_temp_code: parseText(data['REG_TEMP_CODE']),
      reg_temp_desc: parseText(data['REG_TEMP_DESC']),
      classified_code: parseText(data['CLASSIFIED_CODE']),
      classified_desc: parseText(data['CLASSIFIED_DESC']),
      original_hire_date: parseInteger(data['ORIGINAL_HIRE_DATE']),
      last_hire_date: parseLastHireDate(data['LAST_HIRE_DATE']),
      job_entry_date: parseInteger(data['JOB_ENTRY_DATE']),
      full_part_time_code: parseText(data['FULL_PART_TIME_CODE']),
      full_part_time_desc: parseText(data['FULL_PART_TIME_DESC']),
      salary_plan_grid: parseText(data['SALARY_PLAN_GRID']),
      salary_grade_range: parseInteger(data['SALARY_GRADE_RANGE']),
      max_salary_step: parseInteger(data['MAX_SALARY_STEP']),
      compensation_rate: parseFloatValue(data['COMPENSATION_RATE']),
      comp_frequency_code: parseText(data['COMP_FREQUENCY_CODE']),
      comp_frequency_desc: parseText(data['COMP_FREQUENCY_DESC']),
      position_fte: parseFloatValue(data['POSITION_FTE']),
      bargaining_unit_nbr: parseInteger(data['BARGAINING_UNIT_NBR']),
      bargaining_unit_name: parseText(data['BARGAINING_UNIT_NAME']),
      active_on_june_30: activeColName ? parseText(data[activeColName]) : null,
    };
  } catch (error) {
    console.error('[Payroll Import] Error parsing HR row:', error);
    return null;
  }
}

function parseEarningsRow(row: any[], headers: string[]): any | null {
  try {
    const data: Record<string, any> = {};
    headers.forEach((header, i) => {
      data[header] = i < row.length ? row[i] : null;
    });

    const temporaryId = parseText(data['TEMPORARY_ID']);
    if (!temporaryId) return null;

    return {
      temporary_id: temporaryId,
      regular_wages: parseFloatValue(data['REGULAR_WAGES']) || 0.0,
      overtime_wages: parseFloatValue(data['OVERTIME_WAGES']) || 0.0,
      other_wages: parseFloatValue(data['OTHER_WAGES']) || 0.0,
      total_wages: parseFloatValue(data['TOTAL_WAGES']) || 0.0,
    };
  } catch (error) {
    console.error('[Payroll Import] Error parsing earnings row:', error);
    return null;
  }
}

/**
 * POST /api/admin/payroll/import
 * Import payroll data from Excel file
 * 
 * Security:
 * - Rate limited: 100 requests/minute (admin)
 * - Request size limit: 1MB
 * - Input validation with Zod
 * - Requires admin role
 */
export async function POST(request: NextRequest) {
  return withSecurity(
    request,
    async (req, { userId, accountId }) => {
      try {
        // Validate request body
        const validation = await validateRequestBody(req, payrollImportSchema, REQUEST_SIZE_LIMITS.json);
        if (!validation.success) {
          return validation.error;
        }
        
        const { fiscal_year: fiscalYear } = validation.data;

        // Get file path
        const excelDir = join(process.cwd(), 'minnesota_gov', 'State Payrole');
        const filePath = join(excelDir, `fiscal-year-${fiscalYear}.xlsx`);

        // Read Excel file
        let workbook: XLSX.WorkBook;
        try {
          const fileBuffer = await readFile(filePath);
          workbook = XLSX.read(fileBuffer, { type: 'buffer', cellDates: false });
        } catch (error) {
          if (process.env.NODE_ENV === 'development') {
            console.error('[Payroll Import] Error reading file:', error);
          }
          return createErrorResponse(`File not found: fiscal-year-${fiscalYear}.xlsx`, 404);
        }

        // Find sheets
        const hrSheetName = findSheetByPattern(workbook, 'HR INFO');
        const earningsSheetName = findSheetByPattern(workbook, 'EARNINGS');

        if (!hrSheetName) {
          return createErrorResponse('HR INFO sheet not found', 400);
        }
        if (!earningsSheetName) {
          return createErrorResponse('EARNINGS sheet not found', 400);
        }

        // Get active column name
        const activeColName = getActiveColumnName(workbook, fiscalYear);

    // Read HR INFO sheet
    const hrSheet = workbook.Sheets[hrSheetName];
    const hrData = XLSX.utils.sheet_to_json(hrSheet, { header: 1, defval: null }) as any[][];
    const hrHeaders = (hrData[0] || []).map((h: any) => String(h || '').trim());
    const hrRecords: Record<string, any> = {};

    for (let i = 1; i < hrData.length; i++) {
      const parsed = parseHRRow(hrData[i], hrHeaders, activeColName);
      if (parsed && parsed.temporary_id) {
        hrRecords[parsed.temporary_id] = parsed;
      }
    }

    // Read EARNINGS sheet
    const earningsSheet = workbook.Sheets[earningsSheetName];
    const earningsData = XLSX.utils.sheet_to_json(earningsSheet, { header: 1, defval: null }) as any[][];
    const earningsHeaders = (earningsData[0] || []).map((h: any) => String(h || '').trim());
    const earningsRecords: Record<string, any> = {};

    for (let i = 1; i < earningsData.length; i++) {
      const parsed = parseEarningsRow(earningsData[i], earningsHeaders);
      if (parsed && parsed.temporary_id) {
        earningsRecords[parsed.temporary_id] = parsed;
      }
    }

    // Join HR and EARNINGS data
    const records: any[] = [];
    for (const [tempId, hrRecord] of Object.entries(hrRecords)) {
      const earningsRecord = earningsRecords[tempId] || {};
      const combined = {
        ...hrRecord,
        fiscal_year: fiscalYear,
        regular_wages: earningsRecord.regular_wages || 0.0,
        overtime_wages: earningsRecord.overtime_wages || 0.0,
        other_wages: earningsRecord.other_wages || 0.0,
        total_wages: earningsRecord.total_wages || 0.0,
      };
      records.push(combined);
    }

        if (records.length === 0) {
          return createErrorResponse('No valid records found', 400);
        }

        // Batch insert
        const supabase = createServiceClient();
        let totalInserted = 0;
        let totalSkipped = 0;

        for (let i = 0; i < records.length; i += BATCH_SIZE) {
          const batch = records.slice(i, i + BATCH_SIZE);
          try {
            const { data, error } = await supabase
              .from('payroll')
              .insert(batch as any)
              .select('id');

            if (error) {
              if (process.env.NODE_ENV === 'development') {
                console.error(`[Payroll Import] Error inserting batch ${Math.floor(i / BATCH_SIZE) + 1}:`, error);
              }
              totalSkipped += batch.length;
            } else {
              const inserted = data?.length || batch.length;
              totalInserted += inserted;
            }
          } catch (error) {
            if (process.env.NODE_ENV === 'development') {
              console.error(`[Payroll Import] Error inserting batch ${Math.floor(i / BATCH_SIZE) + 1}:`, error);
            }
            totalSkipped += batch.length;
          }
        }

        return createSuccessResponse({
          message: `Import completed for fiscal year ${fiscalYear}`,
          recordsInserted: totalInserted,
          recordsSkipped: totalSkipped,
          totalRecords: records.length,
        });
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('[Payroll Import API] Error:', error);
        }
        return createErrorResponse('Internal server error', 500);
      }
    },
    {
      rateLimit: 'admin',
      requireAdmin: true,
      maxRequestSize: REQUEST_SIZE_LIMITS.json,
    }
  );
}

