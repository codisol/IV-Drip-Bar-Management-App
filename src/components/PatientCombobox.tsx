import { useState } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from './ui/utils';
import { Button } from './ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from './ui/command';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Patient } from '../types';

interface PatientComboboxProps {
  patients: Patient[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
}

export function PatientCombobox({ 
  patients, 
  value, 
  onValueChange,
  placeholder = "Search patient..."
}: PatientComboboxProps) {
  const [open, setOpen] = useState(false);

  const selectedPatient = patients.find(p => p.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          {selectedPatient ? (
            <span>{selectedPatient.name} - {selectedPatient.phone}</span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        <Command>
          <CommandInput placeholder="Type to search patients..." />
          <CommandList>
            <CommandEmpty>No patient found.</CommandEmpty>
            <CommandGroup>
              {patients.map((patient) => (
                <CommandItem
                  key={patient.id}
                  value={`${patient.name} ${patient.phone} ${patient.id}`}
                  onSelect={() => {
                    onValueChange(patient.id);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === patient.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <div className="flex flex-col">
                    <span>{patient.name}</span>
                    <span className="text-xs text-muted-foreground">{patient.phone}</span>
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
