'use client';

import { useState, useEffect } from 'react';
import {
  ChevronRightIcon,
  ChevronDownIcon,
  TableCellsIcon,
  FolderIcon,
} from '@heroicons/react/24/outline';

interface SchemaInfo {
  schema_name: string;
  tables: Array<{
    table_name: string;
    table_type: string;
  }>;
}

interface SchemaSidebarProps {
  onTableSelect?: (schema: string, table: string) => void;
  selectedSchema?: string;
  selectedTable?: string;
}

export default function SchemaSidebar({
  onTableSelect,
  selectedSchema,
  selectedTable,
}: SchemaSidebarProps) {
  const [schemas, setSchemas] = useState<SchemaInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedSchemas, setExpandedSchemas] = useState<Set<string>>(new Set(['public']));

  // Auto-expand selected schema
  useEffect(() => {
    if (selectedSchema && !expandedSchemas.has(selectedSchema)) {
      setExpandedSchemas((prev) => new Set([...prev, selectedSchema]));
    }
  }, [selectedSchema, expandedSchemas]);

  useEffect(() => {
    const fetchSchemas = async () => {
      try {
        const res = await fetch('/api/admin/schemas');
        if (res.ok) {
          const data = await res.json();
          setSchemas(data.schemas || []);
        }
      } catch (error) {
        console.error('Error fetching schemas:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSchemas();
  }, []);

  const toggleSchema = (schemaName: string) => {
    setExpandedSchemas((prev) => {
      const next = new Set(prev);
      if (next.has(schemaName)) {
        next.delete(schemaName);
      } else {
        next.add(schemaName);
      }
      return next;
    });
  };

  const handleTableClick = (schemaName: string, tableName: string) => {
    if (onTableSelect) {
      onTableSelect(schemaName, tableName);
    }
  };

  if (loading) {
    return (
      <div className="h-full flex flex-col bg-surface p-[10px]">
        <div className="text-xs text-foreground-muted">Loading schemas...</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-y-auto scrollbar-hide bg-surface">
      {/* Header */}
      <div className="p-[10px] border-b border-border-muted flex-shrink-0">
        <h2 className="text-xs font-semibold text-white">Database Schemas</h2>
      </div>

      {/* Schema List */}
      <div className="flex-1 overflow-y-auto scrollbar-hide p-[10px] space-y-0.5">
        {schemas.map((schema) => {
          const isExpanded = expandedSchemas.has(schema.schema_name);
          const isSelected = selectedSchema === schema.schema_name;
          const hasTables = schema.tables.length > 0;

          return (
            <div key={schema.schema_name} className="space-y-0.5">
              {/* Schema Header */}
              <button
                onClick={() => toggleSchema(schema.schema_name)}
                className={`w-full flex items-center gap-1.5 px-2 py-1.5 text-xs font-medium rounded transition-colors ${
                  isSelected
                    ? 'bg-surface-accent text-foreground'
                    : 'text-foreground-muted hover:bg-surface-accent'
                }`}
              >
                {isExpanded ? (
                  <ChevronDownIcon className="w-3 h-3 flex-shrink-0" />
                ) : (
                  <ChevronRightIcon className="w-3 h-3 flex-shrink-0" />
                )}
                <FolderIcon className="w-3 h-3 flex-shrink-0" />
                <span className="truncate flex-1 text-left">{schema.schema_name}</span>
                {hasTables && (
                  <span className="text-[10px] text-foreground-muted">
                    {schema.tables.length}
                  </span>
                )}
              </button>

              {/* Tables List */}
              {isExpanded && hasTables && (
                <div className="ml-4 space-y-0.5">
                  {schema.tables.map((table) => {
                    const isTableSelected =
                      selectedSchema === schema.schema_name &&
                      selectedTable === table.table_name;

                    return (
                      <button
                        key={table.table_name}
                        onClick={() => handleTableClick(schema.schema_name, table.table_name)}
                        className={`w-full flex items-center gap-1.5 px-2 py-1 text-[10px] rounded transition-colors ${
                          isTableSelected
                            ? 'bg-lake-blue/10 text-lake-blue border border-lake-blue/20'
                            : 'text-foreground-muted hover:bg-surface-muted'
                        }`}
                      >
                        <TableCellsIcon className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate flex-1 text-left">{table.table_name}</span>
                        {table.table_type === 'VIEW' && (
                          <span className="text-[9px] text-foreground-subtle">view</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Empty State */}
              {isExpanded && !hasTables && (
                <div className="ml-4 px-2 py-1 text-[10px] text-foreground-subtle italic">
                  No tables found
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
