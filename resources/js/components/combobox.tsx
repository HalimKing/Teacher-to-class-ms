import * as React from 'react';
import TextField from '@mui/material/TextField';
import Autocomplete from '@mui/material/Autocomplete';

interface Option {
  label: string;
  value?: string | number;
}

interface ComboBoxProps {
  options: Option[];
  label?: string;
  externalValue?: (value: string | number | undefined) => void;
  defaultValue?: Option | null;
  className?: string;
}

export default function ComboBox({ 
  options, 
  label = "Select Option", 
  externalValue, 
  defaultValue = null,
  className = ""
}: ComboBoxProps) {
  const [value, setValue] = React.useState<Option | null>(defaultValue);

  // Update internal state when defaultValue changes
  React.useEffect(() => {
    setValue(defaultValue);
  }, [defaultValue]);

  const handleOnchange = (event: any, newValue: Option | null) => {
    
    setValue(newValue);
    if (externalValue) {
      externalValue(newValue?.value);
    }
  }

  return (
    <Autocomplete<Option>
      value={value}
      onChange={handleOnchange}
      options={options}
      className={className}
      sx={{ width: '100%' }}
      getOptionLabel={(option) => option.label}
      isOptionEqualToValue={(option, value) => option.value === value.value}
      renderInput={(params) => (
        <TextField {...params} label={label} variant="outlined" />
      )}
    />
  );
}