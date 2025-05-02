import React from 'react';
import { useLanguage } from '@/hooks/use-language';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

interface AnalysisOption {
  id: string;
  label: string;
  description: string;
  defaultChecked: boolean;
}

interface AnalysisOptionsProps {
  options: Record<string, boolean>;
  onOptionChange: (id: string, checked: boolean) => void;
}

export default function AnalysisOptions({ options, onOptionChange }: AnalysisOptionsProps) {
  const { t } = useLanguage();
  
  // Generate analysis options
  const analysisOptions: AnalysisOption[] = [
    {
      id: 'summary',
      label: t('generateSummary'),
      description: t('summaryDesc'),
      defaultChecked: true,
    },
    {
      id: 'genres',
      label: t('identifyGenres'),
      description: t('genresDesc'),
      defaultChecked: true,
    },
    {
      id: 'themes',
      label: t('extractThemes'),
      description: t('themesDesc'),
      defaultChecked: true,
    },
    {
      id: 'readingLevel',
      label: t('assessReadingLevel'),
      description: t('readingLevelDesc'),
      defaultChecked: true,
    },
    {
      id: 'catalogEntry',
      label: t('generateCatalog'),
      description: t('catalogDesc'),
      defaultChecked: true,
    },
  ];

  const handleCheckboxChange = (id: string, checked: boolean) => {
    onOptionChange(id, checked);
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <h3 className="text-lg font-serif font-medium text-neutral-800">{t('analysisOptions')}</h3>
        <div className="mt-4 space-y-4">
          {analysisOptions.map((option) => (
            <div key={option.id} className="flex items-start">
              <div className="flex items-center h-5">
                <Checkbox 
                  id={option.id} 
                  checked={options[option.id]} 
                  onCheckedChange={(checked) => 
                    handleCheckboxChange(option.id, checked as boolean)
                  }
                  className="w-4 h-4"
                />
              </div>
              <div className="ml-3 text-sm">
                <Label 
                  htmlFor={option.id} 
                  className="font-medium text-neutral-700"
                >
                  {option.label}
                </Label>
                <p className="text-neutral-500">{option.description}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
