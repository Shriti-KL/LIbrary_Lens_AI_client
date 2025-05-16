import React, { useState, useEffect } from 'react';
import { Book } from '@shared/schema';
import { useLanguage } from '@/hooks/use-language';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Check, X, Save } from 'lucide-react';
import { Label } from '@/components/ui/label';

interface BatchBookEditorProps {
  book: Partial<Book>;
  onSave: (book: Partial<Book>) => void;
  onCancel: () => void;
}

export default function BatchBookEditor({ book, onSave, onCancel }: BatchBookEditorProps) {
  const { t, language } = useLanguage();
  const [editedBook, setEditedBook] = useState<Partial<Book>>(book);

  // Update local state when book prop changes
  useEffect(() => {
    setEditedBook(book);
  }, [book]);

  // Handle input changes
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    
    // Handle numeric conversions for fields like publicationYear and pageCount
    if ((name === 'publicationYear' || name === 'pageCount') && value) {
      setEditedBook(prev => ({
        ...prev,
        [name]: value === '' ? null : parseInt(value)
      }));
    } else {
      setEditedBook(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  // Format field name for display
  const formatFieldName = (fieldName: string): string => {
    // Use translation if available, otherwise generate from camelCase
    return t(fieldName) || fieldName
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase());
  };

  // Save changes
  const handleSave = () => {
    onSave(editedBook);
  };

  // Define field groups according to importance
  const primaryFields = ['title', 'subtitle', 'author', 'mainAuthor', 'additionalAuthors', 'publicationYear', 'publisher'];
  const secondaryFields = [
    'isbn', 'language', 'pageCount', 'summary', 'review', 'publicationPlace', 
    'edition', 'dimensions', 'binding', 'price', 'classificationNumber',
    'additionalClassifications', 'interestCategory', 'statementOfResponsibility', 
    'illustrations', 'reviewerName', 'idbInitials', 'idbSequenceNumber', 'idbYear',
    'idBNumber', 'idb_initials', 'idb_sequence_number', 'idb_year'
  ];
  
  // Render a field editor
  const renderField = (fieldName: string) => {
    if (!editedBook || !(fieldName in editedBook)) return null;
    
    let value = editedBook[fieldName as keyof typeof editedBook] as string | number | null;
    if (value === null) value = '';
    
    // Use textarea for longer text fields
    const isTextArea = fieldName === 'summary' || fieldName === 'review';
    
    return (
      <div className="mb-4" key={fieldName}>
        <Label htmlFor={fieldName} className="block mb-2 text-sm font-medium text-gray-700">
          {formatFieldName(fieldName)}
        </Label>
        
        {isTextArea ? (
          <Textarea
            id={fieldName}
            name={fieldName}
            value={value as string}
            onChange={handleChange}
            className="w-full"
            rows={4}
          />
        ) : (
          <Input
            type={fieldName === 'publicationYear' ? 'number' : 'text'}
            id={fieldName}
            name={fieldName}
            value={value as string}
            onChange={handleChange}
            className="w-full"
          />
        )}
      </div>
    );
  };

  return (
    <Card className="mb-4">
      <CardHeader>
        <CardTitle className="text-xl font-serif">{t('editBook')}</CardTitle>
      </CardHeader>
      
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h3 className="text-md font-semibold mb-3">{t('primaryInformation')}</h3>
            {primaryFields.map(renderField)}
          </div>
          
          <div>
            <h3 className="text-md font-semibold mb-3">{t('additionalInformation')}</h3>
            {secondaryFields.map(renderField)}
          </div>
        </div>
      </CardContent>
      
      <CardFooter className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel}>
          <X className="h-4 w-4 mr-1" />
          {t('cancel')}
        </Button>
        
        <Button onClick={handleSave} className="bg-green-600 hover:bg-green-700 text-white">
          <Save className="h-4 w-4 mr-1" />
          {t('saveToArchive')}
        </Button>
      </CardFooter>
    </Card>
  );
}