import { useState } from 'react';
import { formatDateTime } from '../utils/dateFormatter';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from './ui/utils';
import { Input } from './ui/input';
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from './ui/command';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Transaction } from '../types';

interface TransactionComboboxProps {
  transactions: Transaction[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  filterByPatient?: string;
  showOnProgressOnly?: boolean;
}

export function TransactionCombobox({
  transactions,
  value,
  onValueChange,
  placeholder = "Search transaction...",
  filterByPatient,
  showOnProgressOnly = false
}: TransactionComboboxProps) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredTransactions = transactions.filter(transaction => {
    const matchesSearch =
      transaction.patientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      transaction.id.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesPatient = !filterByPatient || transaction.patientId === filterByPatient;
    const matchesStatus = !showOnProgressOnly || transaction.status === 'On Progress';

    return matchesSearch && matchesPatient && matchesStatus;
  });

  const selectedTransaction = transactions.find(t => t.id === value);

  const displayValue = selectedTransaction
    ? `${selectedTransaction.patientName} - ${new Date(selectedTransaction.time).toLocaleDateString()} - ${selectedTransaction.status}`
    : '';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div className="relative">
          <Input
            value={open ? searchTerm : displayValue}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              if (!open) setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            placeholder={placeholder}
            className="pr-8"
          />
          <ChevronsUpDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 opacity-50 pointer-events-none" />
        </div>
      </PopoverTrigger>
      <PopoverContent
        className="w-full p-0"
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <Command shouldFilter={false}>
          <CommandList>
            <CommandEmpty>No transaction found.</CommandEmpty>
            <CommandGroup>
              {filteredTransactions.map((transaction) => (
                <CommandItem
                  key={transaction.id}
                  value={transaction.id}
                  onSelect={() => {
                    onValueChange(transaction.id);
                    setSearchTerm('');
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === transaction.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <div className="flex flex-col">
                    <span>{transaction.patientName}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatDateTime(transaction.time)} | {transaction.status} | Rp {transaction.totalPayment.toLocaleString()}
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
