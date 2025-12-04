import { useState } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from './ui/utils';
import { Input } from './ui/input';
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from './ui/command';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { InventoryItem } from '../types';

interface InventoryComboboxProps {
  inventory: InventoryItem[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
}

export function InventoryCombobox({ 
  inventory, 
  value, 
  onValueChange,
  placeholder = "Search inventory item..."
}: InventoryComboboxProps) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const selectedItem = inventory.find(item => item.id === value);
  
  const filteredInventory = inventory.filter(item =>
    item.genericName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.brandName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.batchNumber.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const displayValue = selectedItem 
    ? `${selectedItem.genericName} (${selectedItem.brandName}) - Stock: ${selectedItem.quantity}`
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
            <CommandEmpty>No inventory item found.</CommandEmpty>
            <CommandGroup>
              {filteredInventory.map((item) => (
                <CommandItem
                  key={item.id}
                  value={item.id}
                  onSelect={() => {
                    onValueChange(item.id);
                    setSearchTerm('');
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === item.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <div className="flex flex-col">
                    <span>{item.genericName} ({item.brandName})</span>
                    <span className="text-xs text-muted-foreground">
                      Batch: {item.batchNumber} | Stock: {item.quantity} | {item.strength}
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
