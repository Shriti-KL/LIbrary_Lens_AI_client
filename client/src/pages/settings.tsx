import React, { useState } from 'react';
import { useLanguage } from '@/hooks/use-language';
import { useToast } from '@/hooks/use-toast';
import { Language } from '@/hooks/use-language';
import { ThemeProvider, useTheme } from "next-themes";
import { useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  CheckCircle2,
  Globe,
  Moon,
  Save,
  Settings2,
  Sun,
  Trash2,
  AlertTriangle,
} from 'lucide-react';

export default function Settings() {
  const { t, language, changeLanguage } = useLanguage();
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();
  
  // Show confirmation dialog state
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  
  // API settings
  const [apiKeys, setApiKeys] = useState({
    openai: import.meta.env.VITE_OPENAI_API_KEY || '',
    googleBooks: import.meta.env.VITE_GOOGLE_BOOKS_API_KEY || '',
  });
  
  // Analysis settings
  const [analysisSettings, setAnalysisSettings] = useState({
    defaultSummary: true,
    defaultGenres: true,
    defaultThemes: true,
    defaultReadingLevel: true,
    defaultCatalogEntry: true,
    batchLimit: 10
  });
  
  // Clear all books mutation
  const clearBooksMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('DELETE', '/api/books?confirm=true');
      return response.json();
    },
    onSuccess: (data) => {
      // Invalidate book queries to refresh the UI
      queryClient.invalidateQueries({ queryKey: ['/api/books'] });
      queryClient.invalidateQueries({ queryKey: ['/api/books/recent'] });
      
      toast({
        title: "Data Cleared",
        description: `Successfully removed ${data.count} books from your library.`,
        action: (
          <div className="h-8 w-8 bg-green-500 rounded-full flex items-center justify-center">
            <CheckCircle2 className="h-5 w-5 text-white" />
          </div>
        ),
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to clear books: ${error.message}`,
        variant: "destructive",
      });
    }
  });
  
  // Handle language change
  const handleLanguageChange = (value: string) => {
    changeLanguage(value as Language);
  };
  
  // Handle theme change
  const handleThemeChange = (value: string) => {
    setTheme(value);
  };
  
  // Handle save settings
  const handleSaveSettings = () => {
    // In a real app, this would save settings to the server
    toast({
      title: t('settings') + ' ' + t('complete'),
      description: "Your settings have been saved successfully.",
      action: (
        <div className="h-8 w-8 bg-green-500 rounded-full flex items-center justify-center">
          <CheckCircle2 className="h-5 w-5 text-white" />
        </div>
      ),
    });
  };
  
  // Open confirmation dialog
  const handleClearData = () => {
    setClearDialogOpen(true);
  };
  
  // Confirm and execute data clearing
  const confirmClearData = () => {
    clearBooksMutation.mutate();
    setClearDialogOpen(false);
  };
  
  return (
    <div className="space-y-6">
      {/* Confirmation Dialog for Clear All Books */}
      <AlertDialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Are you sure?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This action will permanently delete ALL books from your library. 
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmClearData}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Yes, Delete All Books
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      <Tabs defaultValue="general" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="general">
            <Settings2 className="h-4 w-4 mr-2" />
            {t('general')}
          </TabsTrigger>
          <TabsTrigger value="api">
            <Globe className="h-4 w-4 mr-2" />
            API
          </TabsTrigger>
          <TabsTrigger value="analysis">
            <Moon className="h-4 w-4 mr-2" />
            {t('analysis')}
          </TabsTrigger>
        </TabsList>
        
        {/* General Settings */}
        <TabsContent value="general">
          <Card>
            <CardHeader>
              <CardTitle>{t('general')} {t('settings')}</CardTitle>
              <CardDescription>
                Manage your application preferences and appearance
              </CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-6">
              {/* Language Selection */}
              <div className="space-y-2">
                <Label htmlFor="language">{t('language')}</Label>
                <Select 
                  value={language} 
                  onValueChange={handleLanguageChange}
                >
                  <SelectTrigger id="language">
                    <SelectValue placeholder="Select language" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="es">Español</SelectItem>
                    <SelectItem value="fr">Français</SelectItem>
                    <SelectItem value="de">Deutsch</SelectItem>
                    <SelectItem value="zh">中文</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {/* Theme Selection */}
              <div className="space-y-2">
                <Label htmlFor="theme">Theme</Label>
                <Select 
                  value={theme || 'system'} 
                  onValueChange={handleThemeChange}
                >
                  <SelectTrigger id="theme">
                    <SelectValue placeholder="Select theme" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light">
                      <div className="flex items-center">
                        <Sun className="h-4 w-4 mr-2" />
                        Light
                      </div>
                    </SelectItem>
                    <SelectItem value="dark">
                      <div className="flex items-center">
                        <Moon className="h-4 w-4 mr-2" />
                        Dark
                      </div>
                    </SelectItem>
                    <SelectItem value="system">System</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <Separator />
              
              {/* Data Management */}
              <div>
                <h3 className="text-lg font-medium mb-2">Data Management</h3>
                <p className="text-sm text-neutral-500 mb-4">
                  Manage your application data and clear analysis history
                </p>
                
                <Button 
                  variant="destructive" 
                  className="flex items-center gap-2"
                  onClick={handleClearData}
                >
                  <Trash2 className="h-4 w-4" />
                  Clear All Analyzed Books
                </Button>
              </div>
            </CardContent>
            
            <CardFooter>
              <Button 
                className="ml-auto flex items-center gap-2"
                onClick={handleSaveSettings}
              >
                <Save className="h-4 w-4" />
                {t('save')} {t('settings')}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
        
        {/* API Settings */}
        <TabsContent value="api">
          <Card>
            <CardHeader>
              <CardTitle>API {t('settings')}</CardTitle>
              <CardDescription>
                Configure API keys and external service connections
              </CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="openai-key">OpenAI API Key</Label>
                <div className="flex gap-2 items-center">
                  <div className="flex-1 font-mono text-sm p-2 border rounded-md bg-neutral-50">
                    {apiKeys.openai ? '••••••••••••••••••••••' : 'No API key set'}
                  </div>
                  <Button variant="outline" size="sm">Update</Button>
                </div>
                <p className="text-xs text-neutral-500">
                  The OpenAI API key is configured through environment variables
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="google-books-key">Google Books API Key</Label>
                <div className="flex gap-2 items-center">
                  <div className="flex-1 font-mono text-sm p-2 border rounded-md bg-neutral-50">
                    {apiKeys.googleBooks ? '••••••••••••••••••••••' : 'No API key set'}
                  </div>
                  <Button variant="outline" size="sm">Update</Button>
                </div>
                <p className="text-xs text-neutral-500">
                  The Google Books API key is configured through environment variables
                </p>
              </div>
            </CardContent>
            
            <CardFooter>
              <Button 
                className="ml-auto flex items-center gap-2"
                onClick={handleSaveSettings}
              >
                <Save className="h-4 w-4" />
                {t('save')} {t('settings')}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
        
        {/* Analysis Settings */}
        <TabsContent value="analysis">
          <Card>
            <CardHeader>
              <CardTitle>{t('analysis')} {t('settings')}</CardTitle>
              <CardDescription>
                Configure default analysis options and behavior
              </CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-6">
              <div>
                <h3 className="text-md font-medium mb-2">Default Analysis Options</h3>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="default-summary" className="flex-1">
                      {t('generateSummary')}
                    </Label>
                    <Switch 
                      id="default-summary" 
                      checked={analysisSettings.defaultSummary}
                      onCheckedChange={(checked) => 
                        setAnalysisSettings(prev => ({ ...prev, defaultSummary: checked }))
                      }
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <Label htmlFor="default-genres" className="flex-1">
                      {t('identifyGenres')}
                    </Label>
                    <Switch 
                      id="default-genres" 
                      checked={analysisSettings.defaultGenres}
                      onCheckedChange={(checked) => 
                        setAnalysisSettings(prev => ({ ...prev, defaultGenres: checked }))
                      }
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <Label htmlFor="default-themes" className="flex-1">
                      {t('extractThemes')}
                    </Label>
                    <Switch 
                      id="default-themes" 
                      checked={analysisSettings.defaultThemes}
                      onCheckedChange={(checked) => 
                        setAnalysisSettings(prev => ({ ...prev, defaultThemes: checked }))
                      }
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <Label htmlFor="default-reading-level" className="flex-1">
                      {t('assessReadingLevel')}
                    </Label>
                    <Switch 
                      id="default-reading-level" 
                      checked={analysisSettings.defaultReadingLevel}
                      onCheckedChange={(checked) => 
                        setAnalysisSettings(prev => ({ ...prev, defaultReadingLevel: checked }))
                      }
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <Label htmlFor="default-catalog" className="flex-1">
                      {t('generateCatalog')}
                    </Label>
                    <Switch 
                      id="default-catalog" 
                      checked={analysisSettings.defaultCatalogEntry}
                      onCheckedChange={(checked) => 
                        setAnalysisSettings(prev => ({ ...prev, defaultCatalogEntry: checked }))
                      }
                    />
                  </div>
                </div>
              </div>
              
              <Separator />
              
              <div className="space-y-2">
                <Label htmlFor="batch-limit">Batch Processing Limit</Label>
                <Select 
                  value={analysisSettings.batchLimit.toString()} 
                  onValueChange={(value) => 
                    setAnalysisSettings(prev => ({ ...prev, batchLimit: parseInt(value) }))
                  }
                >
                  <SelectTrigger id="batch-limit">
                    <SelectValue placeholder="Select limit" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5 books</SelectItem>
                    <SelectItem value="10">10 books</SelectItem>
                    <SelectItem value="20">20 books</SelectItem>
                    <SelectItem value="50">50 books</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-neutral-500">
                  Maximum number of books to process in a single batch
                </p>
              </div>
            </CardContent>
            
            <CardFooter>
              <Button 
                className="ml-auto flex items-center gap-2"
                onClick={handleSaveSettings}
              >
                <Save className="h-4 w-4" />
                {t('save')} {t('settings')}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
