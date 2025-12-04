import React, { useState, useEffect, useMemo } from 'react';
import { Transaction, Patient, InventoryItem } from '../types';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from './ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Badge } from './ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { InventoryCombobox } from './InventoryCombobox';
import { DrugAllocationDialog } from './DrugAllocationDialog';
import { BatchAllocation } from '../utils/batchManagement';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible';
import { Plus, Edit, DollarSign, Pill, Trash2, CheckCircle, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';

interface TransactionsProps {
  transactions: Transaction[];
  patients: Patient[];
  inventory: InventoryItem[];
  onAddTransaction: (transaction: Transaction) => void;
  onUpdateTransaction: (transaction: Transaction) => void;
  onStockOut: (inventoryItemId: string, quantity: number, transactionId: string, batchNumber: string) => void;
}

export function Transactions({ transactions, patients, inventory, onAddTransaction, onUpdateTransaction, onStockOut }: TransactionsProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isAllocationDialogOpen, setIsAllocationDialogOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [initialDrugs, setInitialDrugs] = useState<Transaction['drugsUsed']>([]);
  const [totalPayment, setTotalPayment] = useState(0);
  const [selectedDrugId, setSelectedDrugId] = useState('');
  const [drugQuantity, setDrugQuantity] = useState(0);
  const [filterStatus, setFilterStatus] = useState<'All' | 'On Progress' | 'Paid'>('All');
  const [showManualSelection, setShowManualSelection] = useState(false);

  // Confirmation dialog states
  const [confirmAction, setConfirmAction] = useState<{
    open: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
  }>({
    open: false,
    title: '',
    description: '',
    onConfirm: () => { }
  });

  const handleOpenEdit = (transaction: Transaction) => {
    setSelectedTransaction(transaction);
    setTotalPayment(transaction.totalPayment);
    setSelectedDrugId('');
    setDrugQuantity(0);
    // Capture the initial drugs for this transaction so we can detect newly added drugs
    setInitialDrugs(transaction.drugsUsed ? [...transaction.drugsUsed] : []);
    setIsDialogOpen(true);
  };

  const handleAddDrug = () => {
    if (!selectedTransaction || !selectedDrugId || drugQuantity <= 0) {
      toast.error('Please select a drug and enter quantity');
      return;
    }

    const drug = inventory.find(i => i.id === selectedDrugId);
    if (!drug) {
      toast.error('Drug not found');
      return;
    }

    if (drug.quantity < drugQuantity) {
      toast.error(`Insufficient stock.Available: ${drug.quantity} `);
      return;
    }

    // Check if drug already added
    const existingDrug = selectedTransaction.drugsUsed.find(d => d.drugId === selectedDrugId && d.batchNumber === drug.batchNumber);
    if (existingDrug) {
      toast.error('This drug with same batch is already added. Remove it first to update.');
      return;
    }

    const updatedTransaction: Transaction = {
      ...selectedTransaction,
      drugsUsed: [
        ...selectedTransaction.drugsUsed,
        {
          drugId: selectedDrugId,
          drugName: drug.genericName,
          batchNumber: drug.batchNumber,
          quantity: drugQuantity
        }
      ]
    };

    setSelectedTransaction(updatedTransaction);
    setSelectedDrugId('');
    setDrugQuantity(0);
    toast.success('Drug added to transaction');
  };

  const handleBatchAllocation = (allocations: BatchAllocation[]) => {
    if (!selectedTransaction) return;

    // Add each batch allocation to the transaction
    const newDrugsUsed = allocations.map(allocation => ({
      drugId: allocation.inventoryItemId,
      drugName: `${allocation.genericName} (${allocation.brandName})`,
      batchNumber: allocation.batchNumber,
      quantity: allocation.quantity
    }));

    const updatedTransaction: Transaction = {
      ...selectedTransaction,
      drugsUsed: [...selectedTransaction.drugsUsed, ...newDrugsUsed]
    };

    setSelectedTransaction(updatedTransaction);
    toast.success(`Added drug with ${allocations.length} batch allocation(s) using FEFO`);
  };

  const handleRemoveDrug = (index: number) => {
    if (!selectedTransaction) return;

    const drugToRemove = selectedTransaction.drugsUsed[index];
    const isInitial = initialDrugs.some(d => d.drugId === drugToRemove.drugId && d.batchNumber === drugToRemove.batchNumber);

    setConfirmAction({
      open: true,
      title: 'Remove Drug from Transaction?',
      description: isInitial
        ? `Are you sure you want to remove "${drugToRemove.drugName}"(Batch: ${drugToRemove.batchNumber}) from this transaction ? Note : This drug was part of the saved transaction and the stock was already deducted; removing it will NOT restore stock automatically.`
        : `Are you sure you want to remove "${drugToRemove.drugName}"(Batch: ${drugToRemove.batchNumber}) from this transaction ? This drug was added during this edit and stock has not been deducted yet.`,
      onConfirm: () => {
        const updatedTransaction: Transaction = {
          ...selectedTransaction,
          drugsUsed: selectedTransaction.drugsUsed.filter((_, i) => i !== index)
        };

        setSelectedTransaction(updatedTransaction);
        toast.success(isInitial ? 'Drug removed. Note: Stock was already deducted.' : 'Drug removed. Stock was not deducted.');
        setConfirmAction({ ...confirmAction, open: false });
      }
    });
  };

  const handleSaveTransaction = () => {
    if (!selectedTransaction) return;

    const finalTransaction: Transaction = {
      ...selectedTransaction,
      totalPayment
    };

    // Determine which drugs are newly added in this edit session (compare by drugId+batchNumber)
    const newDrugs = finalTransaction.drugsUsed.filter(fd => {
      return !initialDrugs.some(id => id.drugId === fd.drugId && id.batchNumber === fd.batchNumber);
    });

    // Create stock out movements only for newly added drugs
    newDrugs.forEach(d => {
      try {
        onStockOut(d.drugId, d.quantity, finalTransaction.id, d.batchNumber);
      } catch (err) {
        console.error('Failed to create stock out for', d, err);
      }
    });

    onUpdateTransaction(finalTransaction);
    toast.success('Transaction updated');
    setIsDialogOpen(false);
    setSelectedTransaction(null);
    setInitialDrugs([]);
  };

  const handleMarkAsPaid = (transaction: Transaction) => {
    const patient = patients.find(p => p.id === transaction.patientId);

    setConfirmAction({
      open: true,
      title: 'Mark Transaction as Paid?',
      description: `Are you sure you want to mark this transaction for ${patient?.name || 'Unknown Patient'} (Rp ${transaction.totalPayment.toLocaleString()}) as paid ? This action will finalize the payment status.`,
      onConfirm: () => {
        const updated: Transaction = {
          ...transaction,
          status: 'Paid',
          paidAt: new Date().toISOString()
        };
        onUpdateTransaction(updated);
        toast.success('Transaction marked as paid');
        setConfirmAction({ ...confirmAction, open: false });
      }
    });
  };

  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      if (filterStatus === 'All') return true;
      return t.status === filterStatus;
    }).sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
  }, [transactions, filterStatus]);

  const getTotalRevenue = () => {
    return transactions.filter(t => t.status === 'Paid').reduce((sum, t) => sum + t.totalPayment, 0);
  };

  const getUnpaidTotal = () => {
    return transactions.filter(t => t.status === 'On Progress').reduce((sum, t) => sum + t.totalPayment, 0);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Total Transaksi</CardDescription>
            <CardTitle className="text-gray-900">{transactions.length}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600">Sepanjang waktu</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Total Pendapatan (Lunas)</CardDescription>
            <CardTitle className="text-gray-900">Rp {getTotalRevenue().toLocaleString()}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600">{transactions.filter(t => t.status === 'Paid').length} transaksi lunas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Transaksi Belum Lunas</CardDescription>
            <CardTitle className="text-gray-900">Rp {getUnpaidTotal().toLocaleString()}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600">{transactions.filter(t => t.status === 'On Progress').length} tertunda</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Transaksi</CardTitle>
              <CardDescription>Kelola transaksi dan pembayaran pasien</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Label>Filter:</Label>
              <Select value={filterStatus} onValueChange={(v: string) => setFilterStatus(v as 'All' | 'On Progress' | 'Paid')}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">Semua</SelectItem>
                  <SelectItem value="On Progress">Dalam Proses</SelectItem>
                  <SelectItem value="Paid">Lunas</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID Transaksi</TableHead>
                  <TableHead>Waktu</TableHead>
                  <TableHead>ID Pasien</TableHead>
                  <TableHead>Nama Pasien</TableHead>
                  <TableHead>Obat Digunakan</TableHead>
                  <TableHead>Total Pembayaran</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTransactions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-gray-500 py-8">
                      Tidak ada transaksi ditemukan
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTransactions.map((transaction) => {
                    const patient = patients.find(p => p.id === transaction.patientId);
                    return (
                      <TableRow key={transaction.id}>
                        <TableCell className="font-mono text-xs">{transaction.id}</TableCell>
                        <TableCell className="text-xs">{new Date(transaction.time).toLocaleString('id-ID')}</TableCell>
                        <TableCell className="font-mono text-xs">{patient?.id || '-'}</TableCell>
                        <TableCell>{transaction.patientName}</TableCell>
                        <TableCell>
                          {transaction.drugsUsed.length === 0 ? (
                            <span className="text-gray-400 text-xs">Tidak ada</span>
                          ) : (
                            <div className="text-xs">
                              {transaction.drugsUsed.slice(0, 2).map((drug, idx) => (
                                <div key={idx}>• {drug.drugName} ({drug.quantity})</div>
                              ))}
                              {transaction.drugsUsed.length > 2 && (
                                <div className="text-gray-500">+{transaction.drugsUsed.length - 2} lainnya</div>
                              )}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>Rp {transaction.totalPayment.toLocaleString()}</TableCell>
                        <TableCell>
                          {transaction.status === 'Paid' ? (
                            <Badge className="bg-green-100 text-green-800">Lunas</Badge>
                          ) : (
                            <Badge variant="outline" className="bg-orange-100 text-orange-800">Dalam Proses</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => handleOpenEdit(transaction)}>
                              <Edit className="w-3 h-3" />
                            </Button>
                            {transaction.status === 'On Progress' && transaction.totalPayment >= 0 && (
                              <Button size="sm" variant="outline" onClick={() => handleMarkAsPaid(transaction)}>
                                <CheckCircle className="w-3 h-3 text-green-600" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={(open: boolean) => {
        if (!open) {
          setIsDialogOpen(false);
          setSelectedTransaction(null);
        }
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Transaction</DialogTitle>
            <DialogDescription>
              Add drugs used and set total payment
            </DialogDescription>
          </DialogHeader>

          {selectedTransaction && (
            <div className="space-y-6">
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600">Transaction ID</p>
                    <p className="font-mono">{selectedTransaction.id}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Patient</p>
                    <p>{selectedTransaction.patientName}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Time</p>
                    <p>{new Date(selectedTransaction.time).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Status</p>
                    <Badge variant={selectedTransaction.status === 'Paid' ? 'default' : 'outline'}>
                      {selectedTransaction.status}
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="border-t pt-4 space-y-4">
                <div>
                  <Label className="text-base">Add Drugs Used</Label>
                  <p className="text-sm text-gray-600 mt-1">
                    Choose automatic FEFO allocation or manual batch selection
                  </p>
                </div>

                <Button
                  variant="default"
                  className="w-full"
                  onClick={() => setIsAllocationDialogOpen(true)}
                >
                  <Pill className="w-4 h-4 mr-2" />
                  Add Drug (FEFO Auto-Allocation - Recommended)
                </Button>

                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-900">
                    <strong>Recommended:</strong> FEFO Auto-Allocation automatically dispenses from batches with earliest expiry dates first, ensuring proper pharmaceutical inventory management and preventing drug wastage.
                  </p>
                </div>

                <Collapsible open={showManualSelection} onOpenChange={setShowManualSelection}>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" className="w-full text-sm">
                      <ChevronDown className={`w - 4 h - 4 mr - 2 transition - transform ${showManualSelection ? 'rotate-180' : ''} `} />
                      Advanced: Manual Batch Selection
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-3 pt-3">
                    <div className="p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-900">
                      <strong>Warning:</strong> Manual selection bypasses FEFO logic. Only use if you need to dispense from a specific batch for medical reasons.
                    </div>

                    <div className="grid grid-cols-12 gap-2">
                      <div className="col-span-8">
                        <Label className="text-xs">Select Specific Batch</Label>
                        <InventoryCombobox
                          inventory={inventory.filter(i => i.quantity > 0)}
                          value={selectedDrugId}
                          onValueChange={setSelectedDrugId}
                          placeholder="Search batch..."
                        />
                      </div>
                      <div className="col-span-2">
                        <Label className="text-xs">Quantity</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={drugQuantity || ''}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDrugQuantity(parseFloat(e.target.value) || 0)}
                          placeholder="Qty"
                        />
                      </div>
                      <div className="col-span-2 flex items-end">
                        <Button onClick={handleAddDrug} className="w-full" size="sm">
                          <Plus className="w-4 h-4 mr-1" />
                          Add
                        </Button>
                      </div>
                    </div>

                    {selectedDrugId && inventory.find(i => i.id === selectedDrugId) && (
                      <div className="p-2 bg-gray-100 border border-gray-300 rounded text-xs">
                        <p><strong>Selected:</strong> {inventory.find(i => i.id === selectedDrugId)?.genericName} ({inventory.find(i => i.id === selectedDrugId)?.brandName})</p>
                        <p><strong>Batch:</strong> {inventory.find(i => i.id === selectedDrugId)?.batchNumber}</p>
                        <p><strong>Available:</strong> {inventory.find(i => i.id === selectedDrugId)?.quantity}</p>
                        <p><strong>Expires:</strong> {inventory.find(i => i.id === selectedDrugId)?.expiryDate || 'N/A'}</p>
                      </div>
                    )}
                  </CollapsibleContent>
                </Collapsible>
              </div>

              {selectedTransaction.drugsUsed.length > 0 && (
                <div>
                  <Label className="text-base">Drugs Added to Transaction</Label>
                  <div className="mt-2 space-y-2">
                    {selectedTransaction.drugsUsed.map((drug, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded border">
                        <div className="flex-1">
                          <p className="font-medium">{drug.drugName}</p>
                          <p className="text-sm text-gray-600">
                            Batch: {drug.batchNumber} | Quantity: {drug.quantity}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveDrug(index)}
                        >
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="border-t pt-4">
                <Label className="text-base">Total Payment</Label>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-2xl">Rp</span>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={totalPayment || 0}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTotalPayment(parseFloat(e.target.value) || 0)}
                    placeholder="0"
                    className="text-2xl h-14"
                  />
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveTransaction}>
              <DollarSign className="w-4 h-4 mr-2" />
              Save Transaction
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {selectedTransaction && (
        <DrugAllocationDialog
          open={isAllocationDialogOpen}
          onOpenChange={setIsAllocationDialogOpen}
          inventory={inventory}
          onConfirm={handleBatchAllocation}
        />
      )}

      {/* Confirmation Dialog */}
      <AlertDialog open={confirmAction.open} onOpenChange={(open: boolean) => setConfirmAction({ ...confirmAction, open })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmAction.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirmAction.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmAction.onConfirm}>Yes, Continue</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
