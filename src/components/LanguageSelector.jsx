import React from 'react';
import { useTranslation } from 'react-i18next';
import { FormControl, Select, MenuItem } from '@mui/material';

const languages = [
  { code: 'en', label: 'English' },
  { code: 'zh-CN', label: '简体中文' },
  { code: 'zh-TW', label: '繁體中文' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
  { code: 'es', label: 'Español' },
  { code: 'ja', label: '日本語' },
  { code: 'ko', label: '한국어' }
];

export default function LanguageSelector() {
  const { i18n } = useTranslation();

  const handleChange = (event) => {
    i18n.changeLanguage(event.target.value);
  };

  return (
    <FormControl size="small" sx={{ minWidth: 100 }}>
      <Select
        value={i18n.language?.startsWith('zh') ? (i18n.language === 'zh-TW' ? 'zh-TW' : 'zh-CN') : (languages.find(l => l.code === i18n.language) ? i18n.language : 'en')}
        onChange={handleChange}
        sx={{
          color: 'inherit',
          '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.3)' },
          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.5)' },
          '.MuiSvgIcon-root': { color: 'inherit' },
          fontSize: '0.85rem',
          height: 32
        }}
      >
        {languages.map((lang) => (
          <MenuItem key={lang.code} value={lang.code}>
            {lang.label}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}
