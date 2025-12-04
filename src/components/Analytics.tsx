import { useState, useMemo } from 'react';
import { formatDate } from '../utils/dateFormatter';
import { Transaction, Patient, InventoryItem, SoapNote } from '../types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Badge } from './ui/badge';
import { BarChart3, Download, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

interface AnalyticsProps {
  transactions: Transaction[];
  patients: Patient[];
  inventory: InventoryItem[];
  soapNotes: SoapNote[];
}

type RowDimension = 'patient' | 'date' | 'month' | 'status' | 'drug' | 'none';
type ColumnDimension = 'patient' | 'date' | 'month' | 'status' | 'drug' | 'count' | 'revenue' | 'none';
type ValueType = 'count' | 'revenue' | 'drugQuantity';

interface PivotNode {
  key: string;
  value?: number;
  children?: Map<string, PivotNode>;
  transactions: Transaction[];
  isTotal?: boolean;
}

export function Analytics({ transactions, patients, inventory, soapNotes }: AnalyticsProps) {
  const [rowDimensions, setRowDimensions] = useState<RowDimension[]>(['patient']);
  const [columnDimensions, setColumnDimensions] = useState<ColumnDimension[]>(['status']);
  const [valueType, setValueType] = useState<ValueType>('count');

  // Helper functions
  // formatDate is now imported from utils

  const formatMonth = (dateString: string) => {
    const date = new Date(dateString);
    return `${date.toLocaleString('id-ID', { month: 'long' })} ${date.getFullYear()}`;
  };

  const getDimensionKey = (transaction: Transaction, dimension: RowDimension | ColumnDimension): string => {
    switch (dimension) {
      case 'patient':
        return transaction.patientName;
      case 'date':
        return formatDate(transaction.time);
      case 'month':
        return formatMonth(transaction.time);
      case 'status':
        return transaction.status;
      case 'drug':
        return transaction.drugsUsed.length > 0 ? transaction.drugsUsed[0].drugName : 'No Drugs';
      case 'count':
        return 'Transaction Count';
      case 'revenue':
        return 'Total Revenue';
      case 'none':
        return 'All';
      default:
        return 'Unknown';
    }
  };

  const calculateValue = (txns: Transaction[], type: ValueType): number => {
    switch (type) {
      case 'count':
        return txns.length;
      case 'revenue':
        return txns.reduce((sum, t) => sum + t.totalPayment, 0);
      case 'drugQuantity':
        return txns.reduce((sum, t) =>
          sum + t.drugsUsed.reduce((drugSum, drug) => drugSum + drug.quantity, 0), 0
        );
      default:
        return 0;
    }
  };

  const buildPivotTree = (
    txns: Transaction[],
    dimensions: RowDimension[],
    currentDepth: number = 0
  ): Map<string, PivotNode> => {
    const map = new Map<string, PivotNode>();

    if (currentDepth >= dimensions.length) {
      return map;
    }

    const currentDimension = dimensions[currentDepth];

    txns.forEach(transaction => {
      // Handle 'drug' dimension expansion
      if (currentDimension === 'drug') {
        transaction.drugsUsed.forEach(drug => {
          const key = drug.drugName;
          if (!map.has(key)) {
            map.set(key, { key, transactions: [], children: new Map() });
          }
          map.get(key)!.transactions.push(transaction);
        });
      } else {
        const key = getDimensionKey(transaction, currentDimension);
        if (!map.has(key)) {
          map.set(key, { key, transactions: [], children: new Map() });
        }
        map.get(key)!.transactions.push(transaction);
      }
    });

    // Recursively build children
    map.forEach(node => {
      if (currentDepth + 1 < dimensions.length) {
        node.children = buildPivotTree(node.transactions, dimensions, currentDepth + 1);
      }
    });

    return map;
  };

  // Generate pivot table data
  const pivotData = useMemo(() => {
    // 1. Build Row Tree
    const rowTree = buildPivotTree(transactions, rowDimensions);

    // 2. Get all unique column keys (flattened for now, or we could do nested columns too but let's start with flat columns based on the last col dimension)
    // For simplicity and "Excel-like" feel, usually columns are also hierarchical, but let's stick to one level of columns or a Cartesian product if multiple.
    // Let's support single level columns for now to keep UI manageable, or Cartesian product of column dimensions.

    const getColumnKeys = (txns: Transaction[], dims: ColumnDimension[]): string[] => {
      if (dims.length === 0) return ['Total'];

      const keys = new Set<string>();
      txns.forEach(t => {
        // Create a composite key for multiple column dimensions
        const keyParts = dims.map(d => {
          if (d === 'drug') {
            // This is tricky if multiple drugs. 
            // For simplicity, if 'drug' is a column dimension, we might duplicate transactions? 
            // Let's assume for columns we take the primary value or handle it simply.
            return t.drugsUsed.length > 0 ? t.drugsUsed[0].drugName : 'No Drugs';
          }
          return getDimensionKey(t, d);
        });
        keys.add(keyParts.join(' - '));
      });
      return Array.from(keys).sort();
    };

    const columnKeys = getColumnKeys(transactions, columnDimensions);

    return { rowTree, columnKeys };
  }, [transactions, rowDimensions, columnDimensions]);

  // Helper to get value for a specific row node and column key
  const getCellValue = (node: PivotNode, colKey: string): number => {
    // Filter node transactions by column key
    const filteredTxns = node.transactions.filter(t => {
      const keyParts = columnDimensions.map(d => {
        if (d === 'drug') return t.drugsUsed.length > 0 ? t.drugsUsed[0].drugName : 'No Drugs';
        return getDimensionKey(t, d);
      });
      return keyParts.join(' - ') === colKey;
    });
    return calculateValue(filteredTxns, valueType);
  };

  const getRowTotal = (node: PivotNode): number => {
    return calculateValue(node.transactions, valueType);
  };

  const getColumnTotal = (colKey: string): number => {
    const filteredTxns = transactions.filter(t => {
      const keyParts = columnDimensions.map(d => {
        if (d === 'drug') return t.drugsUsed.length > 0 ? t.drugsUsed[0].drugName : 'No Drugs';
        return getDimensionKey(t, d);
      });
      return keyParts.join(' - ') === colKey;
    });
    return calculateValue(filteredTxns, valueType);
  };

  const getGrandTotal = (): number => {
    return calculateValue(transactions, valueType);
  };

  // Recursive rendering of rows
  const renderRows = (nodes: Map<string, PivotNode>, depth: number = 0): React.ReactNode[] => {
    return Array.from(nodes.entries()).sort().map(([key, node]) => (
      <>
        <TableRow key={`${key}-${depth}`} className={depth === 0 ? 'bg-gray-50 font-medium' : ''}>
          <TableCell style={{ paddingLeft: `${(depth + 1) * 20}px` }} className="border-r-2">
            {depth > 0 && <span className="text-gray-400 mr-2">↳</span>}
            {key}
          </TableCell>
          {pivotData.columnKeys.map((colKey, idx) => (
            <TableCell key={idx} className="text-center">
              {formatValue(getCellValue(node, colKey))}
            </TableCell>
          ))}
          <TableCell className="text-center border-l-2 bg-green-50">
            {formatValue(getRowTotal(node))}
          </TableCell>
        </TableRow>
        {node.children && renderRows(node.children, depth + 1)}
      </>
    ));
  };

  // Export to Excel
  const exportToExcel = () => {
    try {
      const excelData: any[] = [];

      // Header
      const headerRow = ['Dimension', ...pivotData.columnKeys, 'TOTAL'];
      excelData.push(headerRow);

      // Recursive function to add rows
      const addRowsToExcel = (nodes: Map<string, PivotNode>, depth: number = 0) => {
        Array.from(nodes.entries()).sort().forEach(([key, node]) => {
          const indent = '  '.repeat(depth);
          const rowData: (string | number)[] = [`${indent}${key}`];

          pivotData.columnKeys.forEach(colKey => {
            rowData.push(getCellValue(node, colKey));
          });
          rowData.push(getRowTotal(node));
          excelData.push(rowData);

          if (node.children) {
            addRowsToExcel(node.children, depth + 1);
          }
        });
      };

      addRowsToExcel(pivotData.rowTree);

      // Total Row
      const totalRow: (string | number)[] = ['GRAND TOTAL'];
      pivotData.columnKeys.forEach(colKey => {
        totalRow.push(getColumnTotal(colKey));
      });
      totalRow.push(getGrandTotal());
      excelData.push(totalRow);

      const ws = XLSX.utils.aoa_to_sheet(excelData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Pivot Table');
      XLSX.writeFile(wb, `pivot_export_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.success('Excel file exported successfully!');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export Excel file');
    }
  };

  const formatValue = (value: number): string => {
    if (valueType === 'revenue') {
      return `Rp ${value.toLocaleString()}`;
    }
    return value.toString();
  };

  const addRowDimension = () => {
    setRowDimensions([...rowDimensions, 'status']);
  };

  const removeRowDimension = (index: number) => {
    const newDims = [...rowDimensions];
    newDims.splice(index, 1);
    setRowDimensions(newDims);
  };

  const updateRowDimension = (index: number, value: RowDimension) => {
    const newDims = [...rowDimensions];
    newDims[index] = value;
    setRowDimensions(newDims);
  };

  return (
    <div className="space-y-6">
      <Card className="border-blue-100 shadow-sm">
        <CardHeader className="bg-gradient-to-r from-blue-50 to-purple-50">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-600" />
            <CardTitle>Advanced Pivot Table</CardTitle>
          </div>
          <CardDescription>
            Analyze data with multi-level grouping
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          {/* Configuration Section */}
          <div className="grid grid-cols-1 gap-4 p-4 bg-gray-50 rounded-lg border">

            {/* Row Dimensions */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label>Row Grouping Levels</Label>
                <Button variant="outline" size="sm" onClick={addRowDimension}>
                  <Plus className="w-4 h-4 mr-1" /> Add Level
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {rowDimensions.map((dim, idx) => (
                  <div key={idx} className="flex items-center gap-1 bg-white p-1 rounded border">
                    <Select value={dim} onValueChange={(v) => updateRowDimension(idx, v as RowDimension)}>
                      <SelectTrigger className="w-[120px] h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="patient">Patient</SelectItem>
                        <SelectItem value="date">Date</SelectItem>
                        <SelectItem value="month">Month</SelectItem>
                        <SelectItem value="status">Status</SelectItem>
                        <SelectItem value="drug">Drug</SelectItem>
                      </SelectContent>
                    </Select>
                    {rowDimensions.length > 1 && (
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => removeRowDimension(idx)}>
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Column Dimension (Single for now) */}
              <div className="space-y-2">
                <Label>Column Grouping</Label>
                <Select value={columnDimensions[0]} onValueChange={(v) => setColumnDimensions([v as ColumnDimension])}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="patient">Patient</SelectItem>
                    <SelectItem value="date">Date</SelectItem>
                    <SelectItem value="month">Month</SelectItem>
                    <SelectItem value="status">Status</SelectItem>
                    <SelectItem value="drug">Drug</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Value Type */}
              <div className="space-y-2">
                <Label>Value to Calculate</Label>
                <Select value={valueType} onValueChange={(v) => setValueType(v as ValueType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="count">Transaction Count</SelectItem>
                    <SelectItem value="revenue">Total Revenue</SelectItem>
                    <SelectItem value="drugQuantity">Drug Quantity</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button onClick={exportToExcel} className="bg-green-600 hover:bg-green-700">
              <Download className="w-4 h-4 mr-2" />
              Export to Excel
            </Button>
          </div>

          {/* Pivot Table */}
          <div className="border rounded-lg overflow-auto max-h-[600px]">
            <Table>
              <TableHeader className="sticky top-0 bg-white z-10">
                <TableRow>
                  <TableHead className="bg-blue-50 border-r-2 w-[300px]">
                    {rowDimensions.map(d => d.toUpperCase()).join(' > ')}
                  </TableHead>
                  {pivotData.columnKeys.map((colKey, idx) => (
                    <TableHead key={idx} className="text-center bg-blue-50 min-w-[100px]">
                      {colKey}
                    </TableHead>
                  ))}
                  <TableHead className="text-center bg-green-50 border-l-2 min-w-[100px]">TOTAL</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pivotData.rowTree.size === 0 ? (
                  <TableRow>
                    <TableCell colSpan={pivotData.columnKeys.length + 2} className="text-center text-gray-500 py-8">
                      No data available for the selected dimensions
                    </TableCell>
                  </TableRow>
                ) : (
                  <>
                    {renderRows(pivotData.rowTree)}
                    {/* Grand Total Row */}
                    <TableRow className="bg-blue-100 font-bold sticky bottom-0">
                      <TableCell className="border-r-2 border-t-2">
                        GRAND TOTAL
                      </TableCell>
                      {pivotData.columnKeys.map((colKey, idx) => (
                        <TableCell key={idx} className="text-center border-t-2">
                          {formatValue(getColumnTotal(colKey))}
                        </TableCell>
                      ))}
                      <TableCell className="text-center border-l-2 border-t-2 bg-green-100">
                        {formatValue(getGrandTotal())}
                      </TableCell>
                    </TableRow>
                  </>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

