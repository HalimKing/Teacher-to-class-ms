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
  size?: 'small' | 'medium';
}

export default function ComboBox({ 
  options, 
  label = "Select Option", 
  externalValue, 
  defaultValue = null,
  className = "",
  size = "medium",
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
      sx={{ width: '100%', minWidth: 0 }}
      getOptionLabel={(option) => option.label}
      getOptionKey={(option) => String(option.value ?? option.label)}
      isOptionEqualToValue={(option, value) => String(option.value) === String(value.value)}
      renderInput={(params) => (
        <TextField {...params} label={label} variant="outlined" size={size} />
      )}
    />
  );
}