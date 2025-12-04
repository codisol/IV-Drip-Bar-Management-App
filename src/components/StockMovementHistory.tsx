import { useState } from 'react';
import { InventoryItem, InventoryTransaction } from '../types';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Badge } from './ui/badge';
import { Calendar, ArrowDownCircle, ArrowUpCircle, Download } from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

interface StockMovementHistoryProps {
  inventory: InventoryItem[];
  transactions: InventoryTransaction[];
  filterTransactionId?: string;
  initialFilterDate?: string;
}

export function StockMovementHistory({ inventory, transactions, filterTransactionId, initialFilterDate }: StockMovementHistoryProps) {
  const [dateFilter, setDateFilter] = useState({ 
    start: initialFilterDate || '', 
    end: initialFilterDate || '' 
  });
  const [showDateFilter, setShowDateFilter] = useState(!!initialFilterDate);

  const setTodayFilter = () => {
    const today = new Date().toISOString().split('T')[0];
    setDateFilter({ start: today, end: today });
    setShowDateFilter(true);
  };

  // Combine and sort transactions with inventory data
  const enrichedTransactions = transactions.map(trans => {
    const item = inventory.find(i => i.id === trans.inventoryItemId);
    let displayDate = trans.date;
    
    // For IN transactions, use dateReceived if available
    if (trans.type === 'IN' && item?.dateReceived) {
      displayDate = item.dateReceived;
    }
    
    return {
      ...trans,
      displayDate,
      drugName: item?.genericName || 'Unknown Drug',
      brandName: item?.brandName || 'N/A',
      batchNumber: trans.batchNumber || item?.batchNumber || 'N/A'
    };
  });

  const filteredTransactions = enrichedTransactions.filter(trans => {
    if (!showDateFilter) return true;
    const transDate = new Date(trans.displayDate).toISOString().split('T')[0];
    if (dateFilter.start && transDate < dateFilter.start) return false;
    if (dateFilter.end && transDate > dateFilter.end) return false;
    return true;
  }).sort((a, b) => new Date(b.displayDate).getTime() - new Date(a.displayDate).getTime());

  const totalIn = filteredTransactions.filter(t => t.type === 'IN').reduce((sum, t) => sum + t.quantity, 0);
  const totalOut = filteredTransactions.filter(t => t.type === 'OUT').reduce((sum, t) => sum + t.quantity, 0);

  const exportToExcel = () => {
    try {
      if (filteredTransactions.length === 0) {
        toast.error('No data to export');
        return;
      }

      // Prepare data for Excel
      const excelData: any[] = [];

      // Title row with date range
      const periodInfo = showDateFilter && (dateFilter.start || dateFilter.end)
        ? `Stock Movement Report (${dateFilter.start || 'Beginning'} to ${dateFilter.end || 'Present'})`
        : 'Stock Movement Report (All Time)';
      
      excelData.push([periodInfo]);
      excelData.push([]); // Empty row

      // Summary section
      excelData.push(['Summary']);
      excelData.push(['Total Stock IN:', totalIn]);
      excelData.push(['Total Stock OUT:', totalOut]);
      excelData.push(['Net Movement:', totalIn - totalOut]);
      excelData.push(['Total Transactions:', filteredTransactions.length]);
      excelData.push([]); // Empty row

      // Header row for transactions
      excelData.push([
        'Date & Time',
        'Type',
        'Drug Name',
        'Brand Name',
        'Batch Number',
        'Quantity',
        'Reason/Transaction ID'
      ]);

      // Data rows
      filteredTransactions.forEach(trans => {
        excelData.push([
          new Date(trans.displayDate).toLocaleString(),
          trans.type,
          trans.drugName,
          trans.brandName,
          trans.batchNumber,
          trans.quantity,
          trans.transactionId ? `Transaction: ${trans.transactionId}` : (trans.reason || 'N/A')
        ]);
      });

      // Create worksheet
      const ws = XLSX.utils.aoa_to_sheet(excelData);

      // Set column widths
      ws['!cols'] = [
        { wch: 20 }, // Date
        { wch: 10 }, // Type
        { wch: 25 }, // Drug Name
        { wch: 25 }, // Brand Name
        { wch: 15 }, // Batch Number
        { wch: 10 }, // Quantity
        { wch: 30 }  // Reason/Transaction
      ];

      // Merge cells for title
      ws['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 6 } } // Merge title row
      ];

      // Create workbook
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Stock Movement');

      // Generate filename
      const startDate = dateFilter.start || 'all';
      const endDate = dateFilter.end || 'present';
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `stock_movement_${startDate}_to_${endDate}_${timestamp}.xlsx`;

      // Download
      XLSX.writeFile(wb, filename);
      toast.success('Stock movement report exported successfully!');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export stock movement report');
    }
  };

  return (
    <div className="space-y-4">
      {/* Period Information Banner */}
      {showDateFilter && (dateFilter.start || dateFilter.end) && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-sm text-blue-800">
            <strong>Filtered Period:</strong> {dateFilter.start || 'Beginning'} to {dateFilter.end || 'Present'}
            {' '}({filteredTransactions.length} transactions)
          </p>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="grid grid-cols-3 gap-4">
          <div className="p-3 bg-green-50 border border-green-200 rounded">
            <p className="text-xs text-green-600 uppercase">Total Stock In</p>
            <p className="text-xl text-green-900">{totalIn}</p>
          </div>
          <div className="p-3 bg-red-50 border border-red-200 rounded">
            <p className="text-xs text-red-600 uppercase">Total Stock Out</p>
            <p className="text-xl text-red-900">{totalOut}</p>
          </div>
          <div className={`p-3 border rounded ${totalIn - totalOut >= 0 ? 'bg-blue-50 border-blue-200' : 'bg-orange-50 border-orange-200'}`}>
            <p className={`text-xs uppercase ${totalIn - totalOut >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>Net Movement</p>
            <p className={`text-xl ${totalIn - totalOut >= 0 ? 'text-blue-900' : 'text-orange-900'}`}>
              {totalIn - totalOut >= 0 ? '+' : ''}{totalIn - totalOut}
            </p>
          </div>
        </div>

        <div className="flex gap-2 items-center flex-wrap">
          <Button variant="outline" size="sm" onClick={setTodayFilter}>
            <Calendar className="w-4 h-4 mr-2" />
            Today
          </Button>
          <div className="flex items-center gap-1 text-sm text-gray-600">
            <span>Period:</span>
          </div>
          <Input
            type="date"
            placeholder="Start Date"
            value={dateFilter.start}
            onChange={(e) => {
              setDateFilter({ ...dateFilter, start: e.target.value });
              setShowDateFilter(true);
            }}
            className="w-40"
          />
          <span className="text-gray-500">to</span>
          <Input
            type="date"
            placeholder="End Date"
            value={dateFilter.end}
            onChange={(e) => {
              setDateFilter({ ...dateFilter, end: e.target.value });
              setShowDateFilter(true);
            }}
            className="w-40"
          />
          {showDateFilter && (
            <Button variant="ghost" size="sm" onClick={() => {
              setDateFilter({ start: '', end: '' });
              setShowDateFilter(false);
            }}>
              Clear
            </Button>
          )}
          <div className="border-l pl-2 ml-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={exportToExcel}
              className="bg-green-50 hover:bg-green-100 text-green-700 border-green-200"
            >
              <Download className="w-4 h-4 mr-2" />
              Export to Excel
            </Button>
          </div>
        </div>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <div className="max-h-[600px] overflow-y-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-white">
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Drug Name</TableHead>
                <TableHead>Brand Name</TableHead>
                <TableHead>Batch Number</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Reason/Transaction</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTransactions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-gray-500 py-8">
                    No stock movements found
                  </TableCell>
                </TableRow>
              ) : (
                filteredTransactions.map((trans) => {
                  const isHighlighted = filterTransactionId && trans.transactionId === filterTransactionId;
                  return (
                    <TableRow 
                      key={trans.id}
                      className={isHighlighted ? 'bg-teal/10 border-2 border-teal' : ''}
                    >
                      <TableCell className="text-xs">{new Date(trans.displayDate).toLocaleString()}</TableCell>
                      <TableCell>
                        {trans.type === 'IN' ? (
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                            <ArrowDownCircle className="w-3 h-3 mr-1" />
                            IN
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                            <ArrowUpCircle className="w-3 h-3 mr-1" />
                            OUT
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>{trans.drugName}</TableCell>
                      <TableCell className="text-gray-600 text-sm">{trans.brandName}</TableCell>
                      <TableCell className="font-mono text-xs">{trans.batchNumber}</TableCell>
                      <TableCell>{trans.quantity}</TableCell>
                      <TableCell className="text-xs">
                        {trans.transactionId ? (
                          <span className={isHighlighted ? 'text-teal font-medium' : 'text-blue-600'}>
                            Transaction: {trans.transactionId}
                            {isHighlighted && ' ✓'}
                          </span>
                        ) : (
                          trans.reason || 'N/A'
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
