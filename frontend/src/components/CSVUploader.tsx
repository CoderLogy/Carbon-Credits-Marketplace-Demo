'use client';

import { useState } from 'react';
import { Upload } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';

export default function CSVUploader({
  onUpload
}: {
  onUpload: (data: any[]) => void;
}) {
  const [file, setFile] = useState<File | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = () => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split('\n').filter(l => l.trim().length > 0);
      if (lines.length > 1) {
        const headers = lines[0].split(',').map(h => h.trim());
        const data = lines.slice(1).map(line => {
          const values = line.split(',');
          return headers.reduce((obj, header, index) => {
            obj[header] = values[index]?.trim();
            return obj;
          }, {} as any);
        });
        onUpload(data);
        setFile(null);
      }
    };
    reader.readAsText(file);
  };

  return (
    <Card className="bg-white/5 border-white/10 text-white backdrop-blur-sm shadow-xl shadow-black/40">
      <CardHeader>
        <CardTitle className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
          <Upload className="h-5 w-5 text-emerald-400" />
          Upload Data (CSV)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid w-full items-center gap-2">
          <Label htmlFor="csv" className="text-slate-300 font-medium text-sm">Energy Reports / Buildings</Label>
          <div className="relative group">
            <Input 
              key={file ? file.name : 'empty'}
              id="csv" 
              type="file" 
              accept=".csv" 
              onChange={handleFileChange} 
              className="bg-slate-800/80 border-slate-600 text-white file:text-black file:bg-emerald-400 file:border-0 file:mr-4 file:py-2 file:px-4 file:rounded-full file:text-sm file:font-bold hover:border-emerald-400 transition-colors h-14 pt-3 cursor-pointer ring-offset-black focus-visible:ring-emerald-500"
            />
          </div>
        </div>
        <Button 
          onClick={handleUpload} 
          disabled={!file}
          className="w-full bg-emerald-500 hover:bg-emerald-400 text-black shadow-lg shadow-emerald-500/20 disabled:opacity-30 disabled:hover:bg-emerald-500 transition-all font-bold h-11"
        >
          {file ? 'Process CSV' : 'Select a file'}
        </Button>
      </CardContent>
    </Card>
  );
}
