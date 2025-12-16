'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  DocumentTextIcon,
  BuildingOfficeIcon,
  IdentificationIcon,
  BanknotesIcon,
  ClipboardDocumentCheckIcon,
  ShieldCheckIcon,
  ChartBarIcon,
  EnvelopeIcon,
  PhoneIcon,
  GlobeAltIcon,
  CheckCircleIcon,
  ArrowRightIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from '@heroicons/react/24/outline';

export default function BusinessSetupGuide() {
  const [isOpen, setIsOpen] = useState(true); // Component starts open
  const [openSteps, setOpenSteps] = useState<Set<number>>(new Set([1])); // First step open by default

  const toggleStep = (stepNumber: number) => {
    setOpenSteps(prev => {
      const newSet = new Set(prev);
      if (newSet.has(stepNumber)) {
        newSet.delete(stepNumber);
      } else {
        newSet.add(stepNumber);
      }
      return newSet;
    });
  };
  return (
    <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-2 border-b border-gray-200 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
      >
        <div className="flex items-center justify-between gap-1.5">
          <div className="flex items-center gap-1.5">
            <DocumentTextIcon className="w-4 h-4 text-gray-600" />
            <h2 className="text-sm font-semibold text-gray-900">Minnesota Pages Setup Guide</h2>
          </div>
          {isOpen ? (
            <ChevronUpIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
          ) : (
            <ChevronDownIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
          )}
        </div>
        <p className="text-xs text-gray-600 mt-0.5">
          Official step-by-step guide for starting a business in Minnesota
        </p>
      </button>

      {/* Main Content */}
      {isOpen && (
      <div className="p-[10px] space-y-1">
        {/* Introduction */}
        <div className="mb-3">
          <h3 className="text-xs font-semibold text-gray-900 mb-1.5">
            Starting a Business in Minnesota
          </h3>
          <p className="text-xs text-gray-600 leading-relaxed">
            Minnesota offers a supportive environment for entrepreneurs and small business owners. 
            This guide provides the essential steps and resources needed to legally establish and 
            operate your business in the State of Minnesota. Follow these steps in order to ensure 
            compliance with state and federal requirements.
          </p>
        </div>

        {/* Step-by-Step Guide */}
        <div className="space-y-1">
          {/* Step 1 */}
          <div>
            <button
              onClick={() => toggleStep(1)}
              className="w-full flex items-center gap-2 py-2 text-left hover:bg-gray-50 rounded transition-colors"
            >
              <div className="flex-shrink-0 w-6 h-6 bg-gray-700 text-white rounded-full flex items-center justify-center font-semibold text-xs">
                1
              </div>
              <div className="flex-1">
                <h4 className="text-xs font-semibold text-gray-900">
                  Choose Your Business Structure
                </h4>
              </div>
              {openSteps.has(1) ? (
                <ChevronUpIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
              ) : (
                <ChevronDownIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
              )}
            </button>
            {openSteps.has(1) && (
              <div className="pl-8 pr-3 pb-2">
                <p className="text-xs text-gray-600 mb-2">
                  Select the legal structure that best fits your business needs. Common options include:
                </p>
                <ul className="space-y-1.5 text-xs text-gray-600 ml-3">
                  <li className="flex items-start gap-1.5">
                    <CheckCircleIcon className="w-3.5 h-3.5 text-gray-500 mt-0.5 flex-shrink-0" />
                    <span><strong>Sole Proprietorship:</strong> Simplest structure, no formal registration required</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <CheckCircleIcon className="w-3.5 h-3.5 text-gray-500 mt-0.5 flex-shrink-0" />
                    <span><strong>LLC (Limited Liability Company):</strong> Protects personal assets, flexible management</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <CheckCircleIcon className="w-3.5 h-3.5 text-gray-500 mt-0.5 flex-shrink-0" />
                    <span><strong>Corporation (S-Corp or C-Corp):</strong> Separate legal entity, potential tax benefits</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <CheckCircleIcon className="w-3.5 h-3.5 text-gray-500 mt-0.5 flex-shrink-0" />
                    <span><strong>Partnership:</strong> For businesses with multiple owners</span>
                  </li>
                </ul>
                <div className="mt-2 p-2 bg-gray-50 border border-gray-200 rounded">
                  <p className="text-xs text-gray-700">
                    <strong>Resource:</strong> Consult with a business attorney or accountant to determine the best structure for your specific situation.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Step 2 */}
          <div>
            <button
              onClick={() => toggleStep(2)}
              className="w-full flex items-center gap-2 py-2 text-left hover:bg-gray-50 rounded transition-colors"
            >
              <div className="flex-shrink-0 w-6 h-6 bg-gray-700 text-white rounded-full flex items-center justify-center font-semibold text-xs">
                2
              </div>
              <div className="flex-1">
                <h4 className="text-xs font-semibold text-gray-900">
                  Register Your Business Name
                </h4>
              </div>
              {openSteps.has(2) ? (
                <ChevronUpIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
              ) : (
                <ChevronDownIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
              )}
            </button>
            {openSteps.has(2) && (
              <div className="pl-8 pr-3 pb-2">
                <p className="text-xs text-gray-600 mb-2">
                  Ensure your business name is available and register it appropriately:
                </p>
                <ul className="space-y-1.5 text-xs text-gray-600 ml-3">
                  <li className="flex items-start gap-1.5">
                    <CheckCircleIcon className="w-3.5 h-3.5 text-gray-500 mt-0.5 flex-shrink-0" />
                    <span>Check name availability with the Minnesota Secretary of State</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <CheckCircleIcon className="w-3.5 h-3.5 text-gray-500 mt-0.5 flex-shrink-0" />
                    <span>File Articles of Incorporation or Organization if forming an LLC or Corporation</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <CheckCircleIcon className="w-3.5 h-3.5 text-gray-500 mt-0.5 flex-shrink-0" />
                    <span>Register a &quot;Doing Business As&quot; (DBA) name if operating under a different name</span>
                  </li>
                </ul>
                <div className="mt-2 p-2 bg-gray-50 border border-gray-200 rounded">
                  <p className="text-xs text-gray-700">
                    <strong>Action Required:</strong> Visit{' '}
                    <a 
                      href="https://mnsos.gov" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="underline hover:text-gray-900"
                    >
                      mnsos.gov
                    </a>
                    {' '}to search business names and file registration documents online.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Step 3 */}
          <div>
            <button
              onClick={() => toggleStep(3)}
              className="w-full flex items-center gap-3 py-3 text-left hover:bg-gray-50 rounded transition-colors"
            >
              <div className="flex-shrink-0 w-6 h-6 bg-gray-700 text-white rounded-full flex items-center justify-center font-semibold text-xs">
                3
              </div>
              <div className="flex-1">
                <h4 className="text-xs font-semibold text-gray-900">
                  Obtain Federal Tax ID (EIN)
                </h4>
              </div>
              {openSteps.has(3) ? (
                <ChevronUpIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
              ) : (
                <ChevronDownIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
              )}
            </button>
            {openSteps.has(3) && (
              <div className="pl-8 pr-3 pb-2">
                <p className="text-xs text-gray-600 mb-2">
                  Apply for an Employer Identification Number (EIN) from the Internal Revenue Service:
                </p>
                <ul className="space-y-1.5 text-xs text-gray-600 ml-3">
                  <li className="flex items-start gap-1.5">
                    <CheckCircleIcon className="w-3.5 h-3.5 text-gray-500 mt-0.5 flex-shrink-0" />
                    <span>Required for LLCs, Corporations, and businesses with employees</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <CheckCircleIcon className="w-3.5 h-3.5 text-gray-500 mt-0.5 flex-shrink-0" />
                    <span>Free to obtain, can be applied for online at IRS.gov</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <CheckCircleIcon className="w-3.5 h-3.5 text-gray-500 mt-0.5 flex-shrink-0" />
                    <span>Typically received immediately upon application</span>
                  </li>
                </ul>
                <div className="mt-2 p-2 bg-gray-50 border border-gray-200 rounded">
                  <p className="text-xs text-gray-700">
                    <strong>Action Required:</strong> Apply for your EIN at{' '}
                    <a 
                      href="https://www.irs.gov/businesses/small-businesses-self-employed/apply-for-an-ein-online"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline hover:text-gray-900"
                    >
                      IRS.gov
                    </a>
                    . The process takes approximately 15 minutes.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Step 4 */}
          <div>
            <button
              onClick={() => toggleStep(4)}
              className="w-full flex items-center gap-3 py-3 text-left hover:bg-gray-50 rounded transition-colors"
            >
              <div className="flex-shrink-0 w-6 h-6 bg-gray-700 text-white rounded-full flex items-center justify-center font-semibold text-xs">
                4
              </div>
              <div className="flex-1">
                <h4 className="text-xs font-semibold text-gray-900">
                  Register for Minnesota State Taxes
                </h4>
              </div>
              {openSteps.has(4) ? (
                <ChevronUpIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
              ) : (
                <ChevronDownIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
              )}
            </button>
            {openSteps.has(4) && (
              <div className="pl-8 pr-3 pb-2">
                <p className="text-xs text-gray-600 mb-2">
                  Register with the Minnesota Department of Revenue for applicable taxes:
                </p>
                <ul className="space-y-1.5 text-xs text-gray-600 ml-3">
                  <li className="flex items-start gap-1.5">
                    <CheckCircleIcon className="w-3.5 h-3.5 text-gray-500 mt-0.5 flex-shrink-0" />
                    <span><strong>Sales Tax:</strong> Required if selling taxable goods or services</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <CheckCircleIcon className="w-3.5 h-3.5 text-gray-500 mt-0.5 flex-shrink-0" />
                    <span><strong>Withholding Tax:</strong> Required if you have employees</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <CheckCircleIcon className="w-3.5 h-3.5 text-gray-500 mt-0.5 flex-shrink-0" />
                    <span><strong>Corporate Income Tax:</strong> Required for C-Corporations</span>
                  </li>
                </ul>
                <div className="mt-2 p-2 bg-gray-50 border border-gray-200 rounded">
                  <p className="text-xs text-gray-700">
                    <strong>Action Required:</strong> Register online at{' '}
                    <a 
                      href="https://www.revenue.state.mn.us"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline hover:text-gray-900"
                    >
                      revenue.state.mn.us
                    </a>
                    {' '}or call (651) 296-6181.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Step 5 */}
          <div>
            <button
              onClick={() => toggleStep(5)}
              className="w-full flex items-center gap-3 py-3 text-left hover:bg-gray-50 rounded transition-colors"
            >
              <div className="flex-shrink-0 w-6 h-6 bg-gray-700 text-white rounded-full flex items-center justify-center font-semibold text-xs">
                5
              </div>
              <div className="flex-1">
                <h4 className="text-xs font-semibold text-gray-900">
                  Obtain Required Licenses and Permits
                </h4>
              </div>
              {openSteps.has(5) ? (
                <ChevronUpIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
              ) : (
                <ChevronDownIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
              )}
            </button>
            {openSteps.has(5) && (
              <div className="pl-8 pr-3 pb-2">
                <p className="text-xs text-gray-600 mb-2">
                  Determine and obtain necessary business licenses and permits:
                </p>
                <ul className="space-y-1.5 text-xs text-gray-600 ml-3">
                  <li className="flex items-start gap-1.5">
                    <CheckCircleIcon className="w-3.5 h-3.5 text-gray-500 mt-0.5 flex-shrink-0" />
                    <span><strong>State Licenses:</strong> Required for specific industries (healthcare, construction, etc.)</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <CheckCircleIcon className="w-3.5 h-3.5 text-gray-500 mt-0.5 flex-shrink-0" />
                    <span><strong>Local Permits:</strong> Check with your city or county for zoning and business permits</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <CheckCircleIcon className="w-3.5 h-3.5 text-gray-500 mt-0.5 flex-shrink-0" />
                    <span><strong>Professional Licenses:</strong> Required for licensed professions (attorneys, accountants, etc.)</span>
                  </li>
                </ul>
                <div className="mt-2 p-2 bg-gray-50 border border-gray-200 rounded">
                  <p className="text-xs text-gray-700">
                    <strong>Resource:</strong> Use the{' '}
                    <a 
                      href="https://www.sba.gov/business-guide/launch-your-business/get-federal-state-licenses-permits"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline hover:text-gray-900"
                    >
                      SBA License & Permit Tool
                    </a>
                    {' '}to identify required licenses for your business type and location.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Step 6 */}
          <div>
            <button
              onClick={() => toggleStep(6)}
              className="w-full flex items-center gap-3 py-3 text-left hover:bg-gray-50 rounded transition-colors"
            >
              <div className="flex-shrink-0 w-6 h-6 bg-gray-700 text-white rounded-full flex items-center justify-center font-semibold text-xs">
                6
              </div>
              <div className="flex-1">
                <h4 className="text-xs font-semibold text-gray-900">
                  Set Up Business Banking and Accounting
                </h4>
              </div>
              {openSteps.has(6) ? (
                <ChevronUpIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
              ) : (
                <ChevronDownIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
              )}
            </button>
            {openSteps.has(6) && (
              <div className="pl-8 pr-3 pb-2">
                <p className="text-xs text-gray-600 mb-2">
                  Establish financial systems for your business:
                </p>
                <ul className="space-y-1.5 text-xs text-gray-600 ml-3">
                  <li className="flex items-start gap-1.5">
                    <CheckCircleIcon className="w-3.5 h-3.5 text-gray-500 mt-0.5 flex-shrink-0" />
                    <span>Open a separate business bank account (required for LLCs and Corporations)</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <CheckCircleIcon className="w-3.5 h-3.5 text-gray-500 mt-0.5 flex-shrink-0" />
                    <span>Set up business accounting software or hire a bookkeeper</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <CheckCircleIcon className="w-3.5 h-3.5 text-gray-500 mt-0.5 flex-shrink-0" />
                    <span>Establish a system for tracking income and expenses</span>
                  </li>
                </ul>
              </div>
            )}
          </div>

          {/* Step 7 */}
          <div>
            <button
              onClick={() => toggleStep(7)}
              className="w-full flex items-center gap-3 py-3 text-left hover:bg-gray-50 rounded transition-colors"
            >
              <div className="flex-shrink-0 w-6 h-6 bg-gray-700 text-white rounded-full flex items-center justify-center font-semibold text-xs">
                7
              </div>
              <div className="flex-1">
                <h4 className="text-xs font-semibold text-gray-900">
                  Obtain Business Insurance
                </h4>
              </div>
              {openSteps.has(7) ? (
                <ChevronUpIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
              ) : (
                <ChevronDownIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
              )}
            </button>
            {openSteps.has(7) && (
              <div className="pl-8 pr-3 pb-2">
                <p className="text-xs text-gray-600 mb-2">
                  Protect your business with appropriate insurance coverage:
                </p>
                <ul className="space-y-1.5 text-xs text-gray-600 ml-3">
                  <li className="flex items-start gap-1.5">
                    <CheckCircleIcon className="w-3.5 h-3.5 text-gray-500 mt-0.5 flex-shrink-0" />
                    <span><strong>General Liability Insurance:</strong> Protects against claims of bodily injury or property damage</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <CheckCircleIcon className="w-3.5 h-3.5 text-gray-500 mt-0.5 flex-shrink-0" />
                    <span><strong>Workers&apos; Compensation:</strong> Required in Minnesota if you have employees</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <CheckCircleIcon className="w-3.5 h-3.5 text-gray-500 mt-0.5 flex-shrink-0" />
                    <span><strong>Professional Liability:</strong> Recommended for service-based businesses</span>
                  </li>
                </ul>
              </div>
            )}
          </div>

          {/* Step 8 */}
          <div>
            <button
              onClick={() => toggleStep(8)}
              className="w-full flex items-center gap-3 py-3 text-left hover:bg-gray-50 rounded transition-colors"
            >
              <div className="flex-shrink-0 w-6 h-6 bg-gray-700 text-white rounded-full flex items-center justify-center font-semibold text-xs">
                8
              </div>
              <div className="flex-1">
                <h4 className="text-xs font-semibold text-gray-900">
                  Create Your Page Listing
                </h4>
              </div>
              {openSteps.has(8) ? (
                <ChevronUpIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
              ) : (
                <ChevronDownIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
              )}
            </button>
            {openSteps.has(8) && (
              <div className="pl-8 pr-3 pb-2">
                <p className="text-xs text-gray-600 mb-2">
                  Establish your online presence and connect with Minnesota customers:
                </p>
                <ul className="space-y-1.5 text-xs text-gray-600 ml-3">
                  <li className="flex items-start gap-1.5">
                    <CheckCircleIcon className="w-3.5 h-3.5 text-gray-500 mt-0.5 flex-shrink-0" />
                    <span>List your page in the Minnesota Pages Directory</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <CheckCircleIcon className="w-3.5 h-3.5 text-gray-500 mt-0.5 flex-shrink-0" />
                    <span>Create a professional page profile with logo, contact information, and service areas</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <CheckCircleIcon className="w-3.5 h-3.5 text-gray-500 mt-0.5 flex-shrink-0" />
                    <span>Publish content to build credibility and reach customers</span>
                  </li>
                </ul>
                <div className="mt-2 p-2 bg-gray-50 border border-gray-200 rounded">
                  <Link
                    href="/page/new"
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-700 hover:text-gray-900"
                  >
                    Create Your Page Listing
                    <ArrowRightIcon className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Important Resources Section */}
        <div className="border-t border-gray-200 pt-3">
          <h3 className="text-xs font-semibold text-gray-900 mb-2">
            Important Resources
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <div className="p-2 bg-gray-50 border border-gray-200 rounded">
              <div className="flex items-start gap-2">
                <BuildingOfficeIcon className="w-4 h-4 text-gray-500 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-semibold text-gray-900 mb-0.5">Minnesota Secretary of State</h4>
                  <p className="text-xs text-gray-600 mb-1">Business registration and filing</p>
                  <a 
                    href="https://mnsos.gov" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-xs text-gray-700 hover:text-gray-900 underline"
                  >
                    mnsos.gov
                  </a>
                </div>
              </div>
            </div>

            <div className="p-2 bg-gray-50 border border-gray-200 rounded">
              <div className="flex items-start gap-2">
                <BanknotesIcon className="w-4 h-4 text-gray-500 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-semibold text-gray-900 mb-0.5">Minnesota Department of Revenue</h4>
                  <p className="text-xs text-gray-600 mb-1">Tax registration and filing</p>
                  <a 
                    href="https://www.revenue.state.mn.us" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-xs text-gray-700 hover:text-gray-900 underline"
                  >
                    revenue.state.mn.us
                  </a>
                </div>
              </div>
            </div>

            <div className="p-2 bg-gray-50 border border-gray-200 rounded">
              <div className="flex items-start gap-2">
                <ChartBarIcon className="w-4 h-4 text-gray-500 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-semibold text-gray-900 mb-0.5">U.S. Small Business Administration</h4>
                  <p className="text-xs text-gray-600 mb-1">Business planning and resources</p>
                  <a 
                    href="https://www.sba.gov" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-xs text-gray-700 hover:text-gray-900 underline"
                  >
                    sba.gov
                  </a>
                </div>
              </div>
            </div>

            <div className="p-2 bg-gray-50 border border-gray-200 rounded">
              <div className="flex items-start gap-2">
                <ShieldCheckIcon className="w-4 h-4 text-gray-500 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-semibold text-gray-900 mb-0.5">Minnesota Department of Employment</h4>
                  <p className="text-xs text-gray-600 mb-1">Workers&apos; compensation and unemployment</p>
                  <a 
                    href="https://www.deed.state.mn.us" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-xs text-gray-700 hover:text-gray-900 underline"
                  >
                    deed.state.mn.us
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Disclaimer */}
        <div className="border-t border-gray-200 pt-2">
          <p className="text-xs text-gray-500 leading-relaxed">
            <strong>Disclaimer:</strong> This guide provides general information about starting a business in Minnesota. 
            Requirements may vary based on your business type, location, and industry. Consult with a qualified attorney, 
            accountant, or business advisor for specific guidance tailored to your situation. Information is current as of 
            the date of publication and may be subject to change.
          </p>
        </div>
      </div>
      )}
    </div>
  );
}

