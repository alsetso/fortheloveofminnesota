'use client';

import React, { useState } from 'react';
import {
  HomeIcon,
  MapIcon,
  GlobeAltIcon,
  EnvelopeIcon,
  QuestionMarkCircleIcon,
  UserIcon,
  Cog6ToothIcon,
  PhotoIcon,
  MapPinIcon,
  HeartIcon,
  ChevronRightIcon,
  CheckIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import {
  ChevronDownIcon,
  ChevronUpIcon,
} from '@heroicons/react/24/solid';

export default function UIPlayground() {
  const [selectedButton, setSelectedButton] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [checkboxChecked, setCheckboxChecked] = useState(false);

  return (
    <div className="space-y-3">
      {/* Typography */}
      <section className="bg-white border border-gray-200 rounded-md p-[10px] space-y-3">
        <h2 className="text-sm font-semibold text-gray-900">Typography</h2>
        <div className="space-y-2">
          <div>
            <p className="text-xs text-gray-500 mb-1">Headings</p>
            <h1 className="text-sm font-semibold text-gray-900 mb-1">Heading Semibold (text-sm)</h1>
            <h2 className="text-sm font-medium text-gray-900 mb-1">Heading Medium (text-sm)</h2>
            <h3 className="text-xs font-semibold text-gray-900 mb-1">Heading Small (text-xs)</h3>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Body Text</p>
            <p className="text-xs text-gray-600">Body text (text-xs text-gray-600)</p>
            <p className="text-xs text-gray-500">Metadata text (text-xs text-gray-500)</p>
            <p className="text-xs text-gray-900 font-medium">Emphasized text (text-xs font-medium)</p>
          </div>
        </div>
      </section>

      {/* Buttons */}
      <section className="bg-white border border-gray-200 rounded-md p-[10px] space-y-3">
        <h2 className="text-sm font-semibold text-gray-900">Buttons</h2>
        <div className="space-y-2">
          <div>
            <p className="text-xs text-gray-500 mb-2">Primary</p>
            <div className="flex flex-wrap gap-2">
              <button className="px-3 py-1.5 text-xs font-medium text-white bg-gray-900 rounded hover:bg-gray-800 transition-colors">
                Primary Button
              </button>
              <button className="px-3 py-1.5 text-xs font-medium text-gray-900 bg-white border border-gray-200 rounded hover:bg-gray-50 transition-colors">
                Secondary Button
              </button>
              <button className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-50 border border-gray-200 rounded hover:bg-gray-100 transition-colors">
                Tertiary Button
              </button>
            </div>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-2">Icon Buttons</p>
            <div className="flex flex-wrap gap-2">
              <button className="flex items-center gap-2 px-[10px] py-[10px] text-gray-600 hover:bg-gray-50 rounded-md transition-colors">
                <PhotoIcon className="w-4 h-4 text-gray-500" />
                <span className="text-xs font-medium">With Icon</span>
              </button>
              <button className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-md transition-colors">
                <HeartIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-2">States</p>
            <div className="flex flex-wrap gap-2">
              <button className="px-3 py-1.5 text-xs font-medium text-white bg-gray-900 rounded opacity-50 cursor-not-allowed">
                Disabled
              </button>
              <button className="px-3 py-1.5 text-xs font-medium text-white bg-gray-900 rounded hover:bg-gray-800 transition-colors">
                Active
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Cards */}
      <section className="bg-white border border-gray-200 rounded-md p-[10px] space-y-3">
        <h2 className="text-sm font-semibold text-gray-900">Cards</h2>
        <div className="space-y-2">
          <div className="bg-white border border-gray-200 rounded-md p-[10px]">
            <h3 className="text-sm font-medium text-gray-900 mb-1">Standard Card</h3>
            <p className="text-xs text-gray-600">Card with border and padding</p>
          </div>
          <div className="bg-gray-50 border border-gray-200 rounded-md p-[10px]">
            <h3 className="text-sm font-medium text-gray-900 mb-1">Highlighted Card</h3>
            <p className="text-xs text-gray-600">Card with gray background</p>
          </div>
          <div className="bg-white border-l-2 border-gray-300 rounded-md p-[10px]">
            <h3 className="text-sm font-medium text-gray-900 mb-1">Bordered Card</h3>
            <p className="text-xs text-gray-600">Card with left border accent</p>
          </div>
        </div>
      </section>

      {/* Form Elements */}
      <section className="bg-white border border-gray-200 rounded-md p-[10px] space-y-3">
        <h2 className="text-sm font-semibold text-gray-900">Form Elements</h2>
        <div className="space-y-2">
          <div>
            <label className="block text-xs font-medium text-gray-900 mb-1">Input</label>
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Enter text..."
              className="w-full px-[10px] py-[10px] text-xs bg-gray-50 border border-gray-200 rounded-md hover:border-gray-300 focus:outline-none focus:ring-1 focus:ring-gray-500 text-gray-900"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-900 mb-1">Textarea</label>
            <textarea
              placeholder="Enter description..."
              rows={3}
              className="w-full px-[10px] py-[10px] text-xs bg-gray-50 border border-gray-200 rounded-md hover:border-gray-300 focus:outline-none focus:ring-1 focus:ring-gray-500 text-gray-900 resize-none"
            />
          </div>
          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={checkboxChecked}
                onChange={(e) => setCheckboxChecked(e.target.checked)}
                className="w-3 h-3 text-gray-900 border-gray-200 rounded focus:ring-gray-500"
              />
              <span className="text-xs text-gray-600">Checkbox option</span>
            </label>
          </div>
        </div>
      </section>

      {/* Icons */}
      <section className="bg-white border border-gray-200 rounded-md p-[10px] space-y-3">
        <h2 className="text-sm font-semibold text-gray-900">Icons</h2>
        <div className="space-y-2">
          <div>
            <p className="text-xs text-gray-500 mb-2">Sizes</p>
            <div className="flex items-center gap-3">
              <HomeIcon className="w-3 h-3 text-gray-500" />
              <HomeIcon className="w-4 h-4 text-gray-500" />
              <HomeIcon className="w-5 h-5 text-gray-500" />
            </div>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-2">Colors</p>
            <div className="flex items-center gap-3">
              <HomeIcon className="w-4 h-4 text-gray-500" />
              <HomeIcon className="w-4 h-4 text-gray-600" />
              <HomeIcon className="w-4 h-4 text-gray-700" />
              <HomeIcon className="w-4 h-4 text-gray-900" />
            </div>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-2">Common Icons</p>
            <div className="flex flex-wrap gap-3">
              <HomeIcon className="w-4 h-4 text-gray-500" />
              <MapIcon className="w-4 h-4 text-gray-500" />
              <GlobeAltIcon className="w-4 h-4 text-gray-500" />
              <EnvelopeIcon className="w-4 h-4 text-gray-500" />
              <UserIcon className="w-4 h-4 text-gray-500" />
              <HeartIcon className="w-4 h-4 text-gray-500" />
            </div>
          </div>
        </div>
      </section>

      {/* Badges & Tags */}
      <section className="bg-white border border-gray-200 rounded-md p-[10px] space-y-3">
        <h2 className="text-sm font-semibold text-gray-900">Badges & Tags</h2>
        <div className="flex flex-wrap gap-2">
          <span className="px-2 py-0.5 text-xs font-medium text-gray-700 bg-gray-100 rounded border border-gray-200">
            Tag
          </span>
          <span className="px-2 py-0.5 text-xs font-medium text-gray-900 bg-white border border-gray-300 rounded">
            Outlined
          </span>
          <span className="px-2 py-0.5 text-xs font-medium text-gray-600 bg-gray-50 rounded">
            Subtle
          </span>
        </div>
      </section>

      {/* Lists */}
      <section className="bg-white border border-gray-200 rounded-md p-[10px] space-y-3">
        <h2 className="text-sm font-semibold text-gray-900">Lists</h2>
        <div className="space-y-2">
          <div>
            <p className="text-xs text-gray-500 mb-2">Simple List</p>
            <ul className="space-y-1">
              <li className="text-xs text-gray-600">List item one</li>
              <li className="text-xs text-gray-600">List item two</li>
              <li className="text-xs text-gray-600">List item three</li>
            </ul>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-2">Icon List</p>
            <ul className="space-y-1.5">
              <li className="flex items-center gap-2 text-xs text-gray-600">
                <CheckIcon className="w-3 h-3 text-gray-500" />
                <span>Item with icon</span>
              </li>
              <li className="flex items-center gap-2 text-xs text-gray-600">
                <CheckIcon className="w-3 h-3 text-gray-500" />
                <span>Another item</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Navigation Items */}
      <section className="bg-white border border-gray-200 rounded-md p-[10px] space-y-3">
        <h2 className="text-sm font-semibold text-gray-900">Navigation Items</h2>
        <div className="space-y-1">
          <button className="w-full flex items-center gap-2 px-[10px] py-[10px] text-xs text-gray-600 hover:bg-gray-50 rounded-md transition-colors text-left">
            <HomeIcon className="w-4 h-4 text-gray-500" />
            <span className="font-medium">Home</span>
          </button>
          <button className="w-full flex items-center gap-2 px-[10px] py-[10px] text-xs text-gray-900 bg-gray-50 rounded-md text-left">
            <MapIcon className="w-4 h-4 text-gray-700" />
            <span className="font-medium">Map (Active)</span>
          </button>
          <button className="w-full flex items-center justify-between px-[10px] py-[10px] text-xs text-gray-600 hover:bg-gray-50 rounded-md transition-colors text-left">
            <div className="flex items-center gap-2">
              <GlobeAltIcon className="w-4 h-4 text-gray-500" />
              <span className="font-medium">Explore</span>
            </div>
            <ChevronRightIcon className="w-3 h-3 text-gray-500" />
          </button>
        </div>
      </section>

      {/* Empty States */}
      <section className="bg-white border border-gray-200 rounded-md p-[10px] space-y-3">
        <h2 className="text-sm font-semibold text-gray-900">Empty States</h2>
        <div className="space-y-2">
          <div className="text-center py-6 space-y-1.5">
            <div className="flex justify-center">
              <div className="p-2 bg-gray-100 rounded-full">
                <MapPinIcon className="w-4 h-4 text-gray-400" />
              </div>
            </div>
            <p className="text-xs font-medium text-gray-900">No items found</p>
            <p className="text-xs text-gray-500">Start by adding your first item</p>
          </div>
        </div>
      </section>

      {/* Spacing Examples */}
      <section className="bg-white border border-gray-200 rounded-md p-[10px] space-y-3">
        <h2 className="text-sm font-semibold text-gray-900">Spacing Scale</h2>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-4 bg-gray-200 rounded"></div>
            <span className="text-xs text-gray-600">gap-2 (8px)</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-4 bg-gray-200 rounded"></div>
            <span className="text-xs text-gray-600">gap-3 (12px)</span>
          </div>
          <div className="p-[10px] bg-gray-50 rounded border border-gray-200">
            <span className="text-xs text-gray-600">p-[10px] padding</span>
          </div>
        </div>
      </section>

      {/* Color Palette */}
      <section className="bg-white border border-gray-200 rounded-md p-[10px] space-y-3">
        <h2 className="text-sm font-semibold text-gray-900">Color Palette</h2>
        <div className="space-y-2">
          <div className="grid grid-cols-4 gap-2">
            <div>
              <div className="h-8 bg-gray-50 border border-gray-200 rounded mb-1"></div>
              <p className="text-xs text-gray-600">gray-50</p>
            </div>
            <div>
              <div className="h-8 bg-gray-100 border border-gray-200 rounded mb-1"></div>
              <p className="text-xs text-gray-600">gray-100</p>
            </div>
            <div>
              <div className="h-8 bg-gray-200 rounded mb-1"></div>
              <p className="text-xs text-gray-600">gray-200</p>
            </div>
            <div>
              <div className="h-8 bg-gray-500 rounded mb-1"></div>
              <p className="text-xs text-gray-600">gray-500</p>
            </div>
            <div>
              <div className="h-8 bg-gray-600 rounded mb-1"></div>
              <p className="text-xs text-gray-600">gray-600</p>
            </div>
            <div>
              <div className="h-8 bg-gray-700 rounded mb-1"></div>
              <p className="text-xs text-gray-600">gray-700</p>
            </div>
            <div>
              <div className="h-8 bg-gray-900 rounded mb-1"></div>
              <p className="text-xs text-gray-600">gray-900</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

