/**
 * ============================================================================
 * ECLIMAI PROTOTYPE: MAIN DASHBOARD
 * ============================================================================
 * This is a monolithic prototype frontend (1,300+ lines) designed to demonstrate
 * the full end-to-end carbon credit lifecycle without requiring multiple pages.
 * 
 * Architecture Note (For Interns/Reviewers):
 * - State (Hooks): The top section holds ~30 pieces of state simulating the DB/Chain.
 * - API Calls: The 'Data Fetching & Polling' section synchronizes with the Express backend.
 * - Views: The main return statement is divided into Role-Based views:
 *   1. Project Developer (Submit MRV)
 *   2. Auditor/VVB (Verify & Approve)
 *   3. Admin/Bridge (Mint tokens)
 *   4. Market Buyer (Purchase & Retire)
 * ============================================================================
 */
'use client';

import { useState, useEffect } from 'react';
import DemoRoleSwitcher, { UserRole } from '@/components/DemoRoleSwitcher';
import CSVUploader from '@/components/CSVUploader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Info, Leaf, CheckCircle2, Factory, Zap, Activity, AlertTriangle, FileText, Upload, ShieldCheck, ShieldAlert, Download } from 'lucide-react';

export default function Home() {
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  
  // ============================================================================
  // 1. GLOBAL STATE & CONTEXT
  // ============================================================================
  const [role, setRole] = useState<UserRole>('Project Developer');
  const [data, setData] = useState<any[]>([]);
  const [pendingIssuances, setPendingIssuances] = useState<any[]>([]);
  const [walletBalance, setWalletBalance] = useState(15000);
  const [manualEntry, setManualEntry] = useState({ building_name: '', location: '', period_start: '', period_end: '', baseline_kwh: '', actual_kwh: '', emission_factor: '' });
  const [listingPrices, setListingPrices] = useState<Record<number, string>>({});
  const [retireBeneficiary, setRetireBeneficiary] = useState('');
  const [retirePurpose, setRetirePurpose] = useState('');
  const [attestations, setAttestations] = useState<Record<number, boolean>>({});
  const [isPaused, setIsPaused] = useState(false);
  const [kycCompleted, setKycCompleted] = useState(false);
  const [kycCompanyName, setKycCompanyName] = useState('');
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [isAuditLogOpen, setIsAuditLogOpen] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [transferRecipient, setTransferRecipient] = useState('');
  const [retiredCredit, setRetiredCredit] = useState<any>(null);
  const [isCertificateOpen, setIsCertificateOpen] = useState(false);
  
  const [marketplaceCredits, setMarketplaceCredits] = useState<any[]>([]);

  const handleRoleChange = (newRole: UserRole) => {
    setRole(newRole);
    if (typeof window !== 'undefined') {
      localStorage.setItem('userRole', newRole);
    }
  };

  // ============================================================================
  // 2. DATA FETCHING & API UTILS
  // ============================================================================
  const generateHash = async (obj: any) => {
    const rawString = JSON.stringify(obj);
    const encoder = new TextEncoder();
    const data = encoder.encode(rawString);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return "0x" + hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  };

  const fetchBackendData = async () => {
    try {
      const infoRes = await fetch(${API_BASE_URL}/api/system/info).catch(() => null);
      if (infoRes) {
        const info = await infoRes.json();
        const savedBoot = localStorage.getItem('serverBootTime');
        if (savedBoot !== info.bootTime) {
          setKycCompleted(false);
          localStorage.removeItem('kycCompleted');
          localStorage.setItem('serverBootTime', info.bootTime);
        } else {
          const savedKyc = localStorage.getItem('kycCompleted');
          if (savedKyc === 'true') {
            setKycCompleted(true);
            setKycCompanyName(localStorage.getItem('kycCompanyName') || 'Test Corp');
          }
        }
      }

      const res = await fetch(${API_BASE_URL}/api/projects);
      const projects = await res.json();
      
      const mappedData = await Promise.all(projects.map(async (p: any) => ({
        projectId: p.id,
        building_name: p.building_name,
        period_start: p.period_start || '2024-01-01', 
        period_end: p.period_end || '2024-12-31',
        baseline_kwh: p.baseline_kwh || '0',
        actual_kwh: p.actual_kwh || '0',
        emission_factor: p.emission_factor || '0',
        emission_factor_source: p.emission_factor_source || 'Custom',
        calculated_at: p.calculated_at || new Date().toISOString(),
        tco2e: p.estimated_avoided_tco2e,
        rawStatus: p.status,
        ownerId: p.owner_id,
        requestStatus: p.status === 'draft' ? null : 
                       p.status === 'review' ? 'Pending Audit' :
                       p.status === 'approved' ? 'Verified (Pending Mint)' : 
                       p.status === 'rejected' ? 'Rejected' : 
                       p.status === 'issued' ? 'Issued' : 
                       p.status === 'retired' ? 'Retired' : 
                       p.status === 'transferred' ? 'Transferred' : 'Issued',
        dataHash: await generateHash(p),
        isHashValid: !p.building_name.toLowerCase().includes('tampered'),
        area_sqft: 50000,
        location: 'EU'
      })));
      
      setData(mappedData);
      setPendingIssuances(mappedData.filter((d: any) => ['Pending Audit', 'Verified (Pending Mint)', 'Rejected'].includes(d.requestStatus)));
      
      const mktData = projects
        .filter((p: any) => p.status === 'issued' || p.status === 'retired' || p.status === 'transferred' || p.status === 'sold' || p.status === 'listed')
        .map((p: any, idx: number) => {
          const vYear = p.period_end ? new Date(p.period_end).getFullYear().toString() : '2026';
          return {
            id: p.id,
            projectId: p.building_name + (p.building_name.includes('Energy') || p.building_name.includes('Retrofit') ? '' : ' Efficiency'),
            tCO2e: parseFloat(p.estimated_avoided_tco2e || '0'),
            price: p.price ?? (10 + (idx % 5)),
            status: p.status === 'retired' ? 'retired' : (p.status === 'transferred' ? 'transferred' : (p.status === 'sold' ? 'sold' : 'listed')),
            ownerId: p.owner_id,
            beneficiary: p.beneficiary,
            purpose: p.purpose,
            vintage: vYear,
            registryId: `VCU-${vYear}-ECL-${p.id.replace('proj-', '')}`
          };
        });
      setMarketplaceCredits(mktData);
    } catch (e) {
      console.error("Failed to fetch backend data", e);
    }
  };

  // Sync role to localStorage
  useEffect(() => {
    const savedRole = localStorage.getItem('userRole');
    if (savedRole && ['Project Developer', 'Auditor', 'Admin', 'Market Buyer'].includes(savedRole)) {
      setRole(savedRole as UserRole);
    }
  }, []);

  useEffect(() => {
    fetchBackendData();
    
    const handleOffline = () => setIsOffline(true);
    const handleOnline = () => setIsOffline(false);
    
    setIsOffline(!navigator.onLine);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    
    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  // ============================================================================
  // 3. BUSINESS LOGIC HANDLERS (MRV, Approvals, Market)
  // ============================================================================
  const handleUpload = async (uploadedData: any[]) => {
    for (let i = 0; i < uploadedData.length; i++) {
      const row = uploadedData[i];
      // Deliberately inject a tampered name randomly (~15% chance) to trigger the auditor rejection flow
      const isTampered = Math.random() < 0.15;
      const name = isTampered ? `${row.building_name} (Tampered)` : row.building_name;
      try {
        const bRes = await fetch(${API_BASE_URL}/api/buildings, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ walletAddress: '0x123', name: name, location: row.location || 'Unknown' })
        });
        const bData = await bRes.json();
        
        const cRes = await fetch(${API_BASE_URL}/api/calculate, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            buildingId: bData.buildingId,
            periodStart: row.period_start,
            periodEnd: row.period_end,
            baselineKwh: parseFloat(row.baseline_kwh),
            actualKwh: parseFloat(row.actual_kwh),
            emissionFactor: parseFloat(row.emission_factor)
          })
        });
        
        if (cRes.status === 409) {
          const cData = await cRes.json();
          alert(`Row ${i + 1} (${name}): ${cData.message}`);
        }
      } catch (e) {
        console.error("Error uploading", e);
      }
    }
    await fetchBackendData();
  };

  const handleManualSubmit = async () => {
    if (!manualEntry.building_name || !manualEntry.baseline_kwh) return;
    
    try {
      const bRes = await fetch(${API_BASE_URL}/api/buildings, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: '0x123', name: manualEntry.building_name, location: manualEntry.location || 'Unknown' })
      });
      const bData = await bRes.json();
      
        const factorSource = manualEntry.emission_factor === '0.2241' ? 'SEAI 2025 (Ireland)' : 
                             manualEntry.emission_factor === '0.1280' ? 'DEFRA 2025 (UK)' : 'Custom';
                             
        const cRes = await fetch(${API_BASE_URL}/api/calculate, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            buildingId: bData.buildingId,
            periodStart: manualEntry.period_start,
            periodEnd: manualEntry.period_end,
            baselineKwh: parseFloat(manualEntry.baseline_kwh),
            actualKwh: parseFloat(manualEntry.actual_kwh),
            emissionFactor: parseFloat(manualEntry.emission_factor),
            emissionFactorSource: factorSource
          })
        });
        
        if (cRes.status === 409) {
          const cData = await cRes.json();
          alert(cData.message);
          return; // Stop execution here so we don't clear the form
        }
    } catch (e) {
      console.error(e);
    }
    
    setManualEntry({ building_name: '', location: '', period_start: '', period_end: '', baseline_kwh: '', actual_kwh: '', emission_factor: '' });
    await fetchBackendData();
  };

  const handleRequestIssuance = async (rowIndex: number) => {
    const row = data[rowIndex];
    if (row.projectId) {
      try {
        await fetch(`/api/projects/${row.projectId}/submit`, { 
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ attestationAgreed: attestations[rowIndex] || false })
        });
      } catch (e) { console.error(e); }
    }
    await fetchBackendData();
  };

  const handleAuditorVerify = async (index: number) => {
    const req = pendingIssuances[index];
    if (req.projectId) {
      try {
        await fetch(`/api/projects/${req.projectId}/approve`, { method: 'POST' });
      } catch (e) { console.error(e); }
    }
    await fetchBackendData();
  };

  const handleAuditorReject = async (index: number) => {
    const req = pendingIssuances[index];
    if (req.projectId) {
      try {
        await fetch(`/api/projects/${req.projectId}/reject`, { method: 'POST' });
      } catch (e) { console.error(e); }
    }
    await fetchBackendData();
  };

  const handleViewAuditLog = async (projectId: string) => {
    try {
      const res = await fetch(`/api/projects/${projectId}/audit-log`);
      const logs = await res.json();
      setAuditLogs(logs);
      setIsAuditLogOpen(true);
    } catch (e) {
      console.error(e);
    }
  };
  const handleCancelListing = async (id: string) => {
    try {
      await fetch(`/api/projects/${id}/cancel`, { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role })
      });
      setMarketplaceCredits(prev => prev.filter(c => c.id !== id));
      await fetchBackendData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleTransfer = async (id: string) => {
    if (!transferRecipient) return;
    try {
      await fetch(`/api/projects/${id}/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipient: transferRecipient })
      });
      setMarketplaceCredits(prev => prev.map(c => 
        c.id === id ? { ...c, owner: transferRecipient, isTransferred: true } : c
      ));
      setTransferRecipient('');
      await fetchBackendData();
    } catch (e) {
      console.error(e);
    }
  };


  const handleAdminIssue = async (index: number) => {
    const req = pendingIssuances[index];
    const customPrice = listingPrices[index] ? parseFloat(listingPrices[index]) : null;
    
    try {
      await fetch(`/api/projects/${req.projectId}/issue`, { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ price: customPrice })
      });
      await fetchBackendData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleBuy = async (id: string) => {
    const credit = marketplaceCredits.find(c => c.id === id);
    if (!credit) return;
    const cost = credit.tCO2e * credit.price;
    
    if (walletBalance < cost) {
      alert(`Insufficient funds! Cost is €${cost.toLocaleString('en-EU', {minimumFractionDigits: 2, maximumFractionDigits: 2})}, but your balance is €${walletBalance.toLocaleString('en-EU', {minimumFractionDigits: 2, maximumFractionDigits: 2})}.`);
      return;
    }
    
    try {
      await fetch(`/api/projects/${id}/buy`, {
        method: 'POST'
      });
      
      setWalletBalance(prev => prev - cost);
      
      await fetchBackendData();
    } catch (e) {
      console.error(e);
      alert("Failed to purchase token.");
    }
  };

  const handleRetire = async (id: string, beneficiary: string, purpose: string) => {
    const credit = marketplaceCredits.find(c => c.id === id);
    if (!credit) return;
    const cost = credit.tCO2e * credit.price;
    
    try {
      await fetch(`/api/projects/${id}/retire`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ beneficiary, purpose })
      });
      
      setRetiredCredit({
        ...credit,
        beneficiary,
        purpose,
        timestamp: new Date().toISOString(),
        cost
      });
      setIsCertificateOpen(true);
      
      setRetireBeneficiary('');
      setRetirePurpose('');
      
      await fetchBackendData();
    } catch (e) {
      console.error(e);
      alert("Failed to retire token.");
    }
  };

  const handleRelist = async (id: string) => {
    const price = prompt("Enter the new listing price per tCO2e (€):");
    if (!price || isNaN(parseFloat(price))) return;
    
    try {
      await fetch(`/api/projects/${id}/relist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ price: parseFloat(price) })
      });
      
      await fetchBackendData();
    } catch (e) {
      console.error(e);
      alert("Failed to re-list token.");
    }
  };

  const handleClaimAdmin = () => {
    alert('Logged in successfully!');
    handleRoleChange('Admin');
  };

  // ============================================================================
  // 4. MAIN RENDER FUNCTION
  // ============================================================================
  return (
    <TooltipProvider>
      <main className="min-h-screen bg-[#0A0A0A] text-slate-100 font-sans selection:bg-emerald-500/30">
        
        {/* Top Navbar */}
        <nav className="border-b border-white/10 bg-black/40 backdrop-blur-md sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Leaf className="text-emerald-400 h-6 w-6" />
              <h1 className="text-xl font-bold tracking-tight text-white">EclimAi</h1>
              <span className="ml-2 px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 text-xs font-medium border border-amber-500/20">
                Testnet / Demo
              </span>
            </div>
            <DemoRoleSwitcher currentRole={role} onRoleChange={handleRoleChange} />
          </div>
        </nav>

        {isOffline && (
          <div className="bg-yellow-600/20 border-b border-yellow-500/50 text-yellow-500 p-3 flex items-center justify-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            <span className="font-semibold text-sm">You are currently offline. Blockchain interactions and syncing may fail.</span>
          </div>
        )}

        <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
          
          {/* Dynamic Role Dashboard */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            
            {/* Main Workspace based on Role */}
            <div className="lg:col-span-3 space-y-6">
              
              {/* Dynamic Walkthrough Helper */}
              <div className="bg-emerald-900/30 border border-emerald-500/30 rounded-lg p-4 flex items-start gap-4 animate-in slide-in-from-top-2">
                <Info className="h-6 w-6 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-bold text-emerald-300">How to use this view:</h3>
                  <p className="text-sm text-emerald-100/70 mt-1">
                    {role === 'Project Developer' && "Upload the sample `mock_data.csv` file from your project folder. The system will parse the building energy data and calculate the avoided emissions (tCO2e). Click 'Request Issuance' to send the data to the Auditor for verification."}
                    {role === 'Auditor' && "Review the data submitted by the Project Developer. Ensure the baseline and actual kWh align with real-world smart meter data. Click 'Verify Data' to officially approve the MRV metrics and pass them to the Admin."}
                    {role === 'Admin' && "You are the EclimAi bridge node. Tokens are minted here only after external Registry authorization — EclimAi does not issue the underlying credit."}
                    {role === 'Market Buyer' && "Browse the marketplace for verified, tokenized energy efficiency offsets. Click 'Purchase & Retire' to buy the token and instantly retire it to offset your carbon footprint."}
                  </p>
                </div>
              </div>

              {role === 'Project Developer' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
                  <div className="flex justify-between items-end">
                    <div>
                      <h2 className="text-2xl font-semibold text-white">Data Ingestion (IPMVP Option C)</h2>
                      <p className="text-slate-400 text-sm mt-1">Upload weather-normalized building energy reports (Verra VCM Compliant)</p>
                    </div>
                  </div>
                  
                  <Tabs defaultValue="upload" className="w-full">
                    <TabsList className="bg-slate-900 border border-white/10 mb-6 p-1 rounded-lg">
                      <TabsTrigger value="upload" className="text-slate-300 data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-400">CSV Upload</TabsTrigger>
                      <TabsTrigger value="manual" className="text-slate-300 data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-400">Manual Entry</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="upload">
                      <CSVUploader onUpload={handleUpload} />
                    </TabsContent>
                    
                    <TabsContent value="manual">
                      <Card className="bg-white/5 border-white/10 text-white backdrop-blur-sm shadow-xl shadow-black/40">
                        <CardHeader>
                          <CardTitle className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                            <FileText className="h-5 w-5 text-emerald-400" />
                            Manual Data Entry
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label className="text-slate-300">Building Name</Label>
                              <Input className="bg-white/10 border-white/20 text-white placeholder:text-slate-400 focus-visible:ring-emerald-500/50" value={manualEntry.building_name} onChange={e => setManualEntry({...manualEntry, building_name: e.target.value})} placeholder="e.g. Frankfurt HQ" />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-slate-300">Emission Factor (kgCO2e/kWh)</Label>
                              <Select value={manualEntry.emission_factor} onValueChange={val => setManualEntry({...manualEntry, emission_factor: val || ''})}>
                                <SelectTrigger className="bg-white/10 border-white/20 text-white focus:ring-emerald-500/50">
                                  <SelectValue placeholder="Select region factor" />
                                </SelectTrigger>
                                <SelectContent className="bg-slate-900 border-white/10 text-white">
                                  <SelectItem value="0.2241">SEAI 2025 (Ireland) - 0.2241</SelectItem>
                                  <SelectItem value="0.1280">DEFRA 2025 (UK) - 0.1280</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label className="text-slate-300">Period Start</Label>
                              <Input type="date" className="bg-white/10 border-white/20 text-white focus-visible:ring-emerald-500/50" value={manualEntry.period_start} onChange={e => setManualEntry({...manualEntry, period_start: e.target.value})} />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-slate-300">Period End</Label>
                              <Input type="date" className="bg-white/10 border-white/20 text-white focus-visible:ring-emerald-500/50" value={manualEntry.period_end} onChange={e => setManualEntry({...manualEntry, period_end: e.target.value})} />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-slate-300">Baseline kWh</Label>
                              <Input type="number" className="bg-white/10 border-white/20 text-white placeholder:text-slate-400 focus-visible:ring-emerald-500/50" value={manualEntry.baseline_kwh} onChange={e => setManualEntry({...manualEntry, baseline_kwh: e.target.value})} placeholder="0" />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-slate-300">Actual kWh</Label>
                              <Input type="number" className="bg-white/10 border-white/20 text-white placeholder:text-slate-400 focus-visible:ring-emerald-500/50" value={manualEntry.actual_kwh} onChange={e => setManualEntry({...manualEntry, actual_kwh: e.target.value})} placeholder="0" />
                            </div>
                          </div>
                          <Button onClick={handleManualSubmit} className="w-full bg-gradient-to-r from-emerald-500 to-emerald-400 text-black hover:from-emerald-400 hover:to-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.3)] hover:shadow-[0_0_25px_rgba(16,185,129,0.5)] transition-all font-bold h-11">
                            Submit Data
                          </Button>
                        </CardContent>
                      </Card>
                    </TabsContent>
                  </Tabs>
                  
                  {data.length > 0 && (
                    <Card className="bg-white/5 border-white/10 text-white backdrop-blur-sm">
                      <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                          <Activity className="h-5 w-5 text-emerald-400" />
                          Validated Energy Reports
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <Table>
                          <TableHeader className="border-white/10">
                            <TableRow className="hover:bg-transparent border-white/10">
                              <TableHead className="text-slate-400">Building</TableHead>
                              <TableHead className="text-slate-400">Period</TableHead>
                              <TableHead className="text-slate-400">Saved (kWh)</TableHead>
                              <TableHead className="text-slate-400 flex items-center gap-1">
                                Avoided tCO₂e
                                <Tooltip>
                                  <TooltipTrigger>
                                    <Info className="h-4 w-4 text-emerald-400 hover:text-emerald-300 transition-colors" />
                                  </TooltipTrigger>
                                  <TooltipContent className="bg-slate-800 border-slate-700 text-sm">
                                    <p className="font-semibold text-emerald-400 mb-1">IPMVP Option C & Verra VCM</p>
                                    <p className="text-xs text-slate-300 mb-2">Calculates avoided emissions using weather-normalized baselines.</p>
                                    <p>Formula: <code className="bg-slate-900 px-1 py-0.5 rounded text-emerald-300">((Baseline ± Adj.) - Actual) * Factor / 1000</code></p>
                                    <div className="mt-2 text-[10px] font-bold text-emerald-500 bg-emerald-500/10 inline-block px-2 py-0.5 rounded border border-emerald-500/20 uppercase tracking-wider">CCP-Ready</div>
                                  </TooltipContent>
                                </Tooltip>
                              </TableHead>
                              <TableHead className="text-slate-400">
                                <div className="flex items-center gap-1.5">
                                  Merkle Root
                                  <span className="bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 text-[9px] border border-blue-500/30 px-1 py-0 h-4 rounded-full flex items-center font-semibold uppercase tracking-wider">Chainlink Oracle</span>
                                </div>
                              </TableHead>
                              <TableHead className="text-slate-400 text-right">Action</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {data.map((row, i) => {
                              const baseline = parseFloat(row.baseline_kwh || '0');
                              const actual = parseFloat(row.actual_kwh || '0');
                              const factor = parseFloat(row.emission_factor || '0');
                              const saved = baseline - actual;
                              const tco2e = (saved * factor) / 1000;
                              const isPending = row.requestStatus === 'Pending Audit' || row.requestStatus === 'Verified (Pending Mint)' || row.requestStatus === 'Issued' || row.requestStatus === 'Retired' || row.requestStatus === 'Rejected';
                              
                              return (
                                <TableRow key={i} className="border-white/5 hover:bg-white/5 transition-colors">
                                  <TableCell className="font-medium text-slate-200">{row.building_name}</TableCell>
                                  <TableCell className="text-slate-400 text-xs">{row.period_start} to {row.period_end}</TableCell>
                                  <TableCell className="text-slate-300">{saved.toLocaleString()}</TableCell>
                                  <TableCell>
                                    <Dialog>
                                      <DialogTrigger className="font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 underline underline-offset-4 decoration-emerald-500/50">
                                        {tco2e.toFixed(2)} <Info className="h-3 w-3" />
                                      </DialogTrigger>
                                      <DialogContent className="bg-slate-900 text-white border-white/10 max-w-lg">
                                        <DialogHeader>
                                          <DialogTitle className="flex items-center gap-2 text-emerald-400">
                                            <Activity className="h-5 w-5" /> Carbon Calculation
                                          </DialogTitle>
                                          <DialogDescription className="text-slate-400">
                                            Calculated according to IPMVP Option C and Verra VM0018 / VM0025 methodologies.
                                          </DialogDescription>
                                        </DialogHeader>
                                        <div className="space-y-4 py-4 text-sm text-slate-300 font-mono">
                                          <div className="flex justify-between border-b border-white/10 pb-2">
                                            <span className="text-slate-400">Formula:</span>
                                            <span className="text-emerald-300">((Baseline) - Actual) * Factor / 1000</span>
                                          </div>
                                          <div className="flex justify-between border-b border-white/10 pb-2">
                                            <span className="text-slate-400">Input Values:</span>
                                            <span>Baseline: {Number(row.baseline_kwh).toLocaleString()} | Actual: {Number(row.actual_kwh).toLocaleString()}</span>
                                          </div>
                                          <div className="flex justify-between border-b border-white/10 pb-2">
                                            <span className="text-slate-400">Units:</span>
                                            <span>Energy: kWh | Emissions: kgCO₂e/kWh</span>
                                          </div>
                                          <div className="flex justify-between border-b border-white/10 pb-2">
                                            <span className="text-slate-400">Emission Factor:</span>
                                            <span className="text-cyan-400">{row.emission_factor} kgCO₂e/kWh ({row.emission_factor_source || 'Grid Average'})</span>
                                          </div>
                                          <div className="flex justify-between border-b border-white/10 pb-2">
                                            <span className="text-slate-400">Assumptions:</span>
                                            <span>Weather-normalized. Scope 2 emissions only.</span>
                                          </div>
                                          <div className="flex justify-between border-b border-white/10 pb-2 bg-emerald-500/10 p-2 rounded">
                                            <span className="text-emerald-400 font-bold">Calculation Result:</span>
                                            <span className="font-bold text-white">{row.tco2e.toFixed(2)} tCO₂e</span>
                                          </div>
                                          <div className="flex justify-between text-xs pt-2">
                                            <span className="text-slate-500">Timestamp: {row.calculated_at}</span>
                                            <span className="text-slate-500">Version: v1.0.0</span>
                                          </div>
                                        </div>
                                      </DialogContent>
                                    </Dialog>
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex items-center gap-1">
                                      <span className="font-mono text-xs text-slate-500 truncate w-20">{row.dataHash}</span>
                                      {row.isHashValid ? <ShieldCheck className="h-4 w-4 text-emerald-500" /> : <ShieldAlert className="h-4 w-4 text-red-500" />}
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <div className="flex flex-col items-end gap-2">
                                      {!isPending && (
                                        <label className="flex items-center gap-1.5 text-[10px] text-slate-400 max-w-[150px] leading-tight text-right justify-end cursor-pointer">
                                          <input 
                                            type="checkbox" 
                                            className="rounded border-white/20 bg-black/50 text-emerald-500 accent-emerald-500"
                                            checked={attestations[i] || false}
                                            onChange={(e) => setAttestations({...attestations, [i]: e.target.checked})}
                                          />
                                          I confirm this reduction has not been claimed elsewhere
                                        </label>
                                      )}
                                      <Button 
                                        onClick={() => handleRequestIssuance(i)} 
                                        disabled={isPending || (!isPending && !attestations[i])}
                                        size="sm" 
                                        className={row.requestStatus === 'Rejected' ? "bg-red-900/50 text-red-400 border border-red-500/50 w-full hover:bg-red-900/50 cursor-not-allowed" : isPending ? "bg-slate-700 text-slate-300 w-full" : "bg-emerald-600 hover:bg-emerald-500 text-white w-full"}
                                      >
                                        {isPending ? row.requestStatus : 'Request Issuance'}
                                      </Button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              )
                            })}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}

              {role === 'Auditor' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
                  <h2 className="text-2xl font-semibold text-white">Auditor Verification Queue</h2>
                  <p className="text-slate-400 text-sm">Verify MRV reports submitted by Project Developers before minting.</p>
                  
                  {pendingIssuances.filter(r => r.requestStatus === 'Pending Audit').length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-12 border border-dashed border-white/20 rounded-xl bg-white/5">
                      <CheckCircle2 className="h-12 w-12 text-emerald-500/50 mb-4" />
                      <p className="text-slate-400">No projects require auditing right now.</p>
                    </div>
                  ) : (
                    <div className="grid gap-4">
                      {pendingIssuances.map((req, i) => (req.requestStatus === 'Pending Audit' || req.requestStatus === 'Rejected') && (
                        <Card key={i} className={`bg-slate-900 border ${req.isHashValid ? 'border-yellow-500/30' : 'border-red-500/50'}`}>
                          <CardContent className="p-6 flex items-center justify-between">
                            <div>
                              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                {req.building_name}
                                {req.requestStatus === 'Pending Audit' ? (
                                  <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded border border-yellow-500/30">AWAITING AUDIT</span>
                                ) : (
                                  <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded border border-red-500/30">REJECTED</span>
                                )}
                              </h3>
                              <p className="text-sm text-slate-400 mt-1">Area: {req.area_sqft} sqft | Baseline: {req.baseline_kwh} kWh | Actual: {req.actual_kwh} kWh</p>
                              <div className="mt-2 flex items-center gap-2">
                                <span className="text-xs text-slate-500">Merkle Root: <code className="bg-black px-1 py-0.5 rounded text-slate-400">{req.dataHash}</code></span>
                                {req.isHashValid ? (
                                  <span className="text-xs text-emerald-400 flex items-center gap-1"><ShieldCheck className="h-3 w-3"/> Hash Valid</span>
                                ) : (
                                  <span className="text-xs text-red-400 flex items-center gap-1 font-bold"><ShieldAlert className="h-3 w-3"/> Hash Mismatch - TAMPERED</span>
                                )}
                              </div>
                            </div>
                            
                            {req.requestStatus === 'Pending Audit' && (
                              <div className="flex gap-2">
                                <Button 
                                  onClick={() => handleViewAuditLog(req.projectId)}
                                  variant="outline"
                                  className="border-white/20 text-slate-300 hover:bg-white/10 shadow-none bg-transparent"
                                >
                                  View History
                                </Button>
                                {req.isHashValid ? (
                                  <Button 
                                    onClick={() => handleAuditorVerify(i)}
                                    className="bg-yellow-600 hover:bg-yellow-500 text-black font-bold shadow-lg shadow-yellow-500/20"
                                  >
                                    Verify Data
                                  </Button>
                                ) : (
                                  <Button 
                                    onClick={() => handleAuditorReject(i)}
                                    variant="destructive"
                                    className="font-bold shadow-lg"
                                  >
                                    Reject Data
                                  </Button>
                                )}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}


                </div>
              )}

              {role === 'Admin' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
                  <div className="flex justify-between items-start">
                    <div>
                      <h2 className="text-2xl font-semibold text-white">Admin Queue</h2>
                      <p className="text-slate-400 text-sm">Review verified MRV data and mint ERC-1155 VCUs.</p>
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        onClick={() => setIsPaused(!isPaused)}
                        variant="outline" 
                        className={isPaused ? "bg-red-900/50 text-red-300 border-red-500/50 hover:bg-red-800/50 h-9 px-3" : "bg-white/5 text-slate-300 border-white/10 hover:bg-white/10 h-9 px-3"}
                      >
                        {isPaused ? 'Marketplace Paused' : 'Emergency Pause'}
                      </Button>
                    </div>
                  </div>
                  
                  {pendingIssuances.filter(r => r.requestStatus === 'Verified (Pending Mint)' || r.requestStatus === 'Issued').length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-12 border border-dashed border-white/20 rounded-xl bg-white/5">
                      <CheckCircle2 className="h-12 w-12 text-emerald-500/50 mb-4" />
                      <p className="text-slate-400">No pending issuance requests.</p>
                    </div>
                  ) : (
                    <div className="grid gap-4">
                      {pendingIssuances.map((req, i) => (req.requestStatus === 'Verified (Pending Mint)' || req.requestStatus === 'Issued') && (
                        <Card key={i} className="bg-slate-900 border-indigo-500/30">
                          <CardContent className="p-6 flex items-center justify-between">
                            <div>
                              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                {req.building_name}
                                {req.requestStatus === 'Issued' && <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/30">MINTED</span>}
                              </h3>
                              <p className="text-sm text-slate-400 mt-1">Location: {req.location} | Grid Factor: {req.emission_factor} kgCO₂e/kWh</p>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="flex flex-col gap-1 w-24">
                                  <Label className="text-[10px] text-slate-400 uppercase tracking-wider">Set Price (€)</Label>
                                  <Input 
                                    type="number" 
                                    className="h-9 bg-black/50 border-white/10 text-white" 
                                    placeholder="10.00"
                                    value={listingPrices[i] || ''}
                                    onChange={(e) => setListingPrices({...listingPrices, [i]: e.target.value})}
                                  />
                                </div>
                              <Button 
                                onClick={() => handleAdminIssue(i)}
                                className="bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20 h-9 self-end"
                              >
                                Mint & List on Marketplace
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                  
                  {data.length > 0 && (
                    <div className="mt-12 space-y-4 pt-8 border-t border-white/10">
                      <h2 className="text-2xl font-semibold text-white">Global Token Registry</h2>
                      <p className="text-slate-400 text-sm">Read-only view of all projects and credits across the network.</p>
                      <div className="grid gap-4">
                        {data.map((d: any, i: number) => (
                          <Card key={i} className="bg-slate-900 border-white/10">
                            <CardContent className="p-4 flex items-center justify-between">
                              <div>
                                <h3 className="text-md font-bold text-white flex items-center gap-2">
                                  {d.building_name}
                                  <span className="text-xs bg-slate-500/20 text-slate-300 px-2 py-0.5 rounded border border-slate-500/30 uppercase">{d.requestStatus}</span>
                                </h3>
                                <p className="text-xs text-slate-400 mt-1 font-mono">{d.projectId}</p>
                              </div>
                              <div className="flex gap-2">
                                {['issued', 'listed'].includes(d.rawStatus) && (
                                  <Button 
                                    variant="destructive" 
                                    className="border-white/10 h-9" 
                                    onClick={() => handleCancelListing(d.projectId)}
                                  >
                                    Cancel Listing
                                  </Button>
                                )}
                                <Button variant="outline" className="border-white/10 text-slate-300 hover:bg-white/5 hover:text-white h-9" onClick={() => handleViewAuditLog(d.projectId)}>
                                  View Audit History
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {role === 'Market Buyer' && !kycCompleted && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-xl mx-auto mt-12">
                  <Card className="bg-black/60 border-emerald-500/30 backdrop-blur-xl shadow-[0_0_30px_rgba(52,211,153,0.15)]">
                    <CardHeader className="text-center pb-2">
                      <ShieldCheck className="h-12 w-12 text-emerald-400 mx-auto mb-2" />
                      <CardTitle className="text-2xl font-bold text-white">Complete KYC Verification</CardTitle>
                      <CardDescription className="text-slate-400">Identity verification is required before accessing the marketplace.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4 pt-4">
                      <div className="space-y-2">
                        <Label className="text-slate-300">Company Name</Label>
                        <Input placeholder="e.g. Acme Corp" value={kycCompanyName} onChange={e => setKycCompanyName(e.target.value)} className="bg-black/50 border-white/10 text-white focus-visible:ring-emerald-500" />
                      </div>
                      <Button 
                        onClick={() => {
                          setKycCompleted(true);
                          localStorage.setItem('kycCompleted', 'true');
                          localStorage.setItem('kycCompanyName', kycCompanyName);
                        }}
                        disabled={!kycCompanyName}
                        className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold h-11"
                      >
                        Verify & Continue
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              )}

              {role === 'Market Buyer' && kycCompleted && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
                  <div className="flex justify-between items-end">
                    <div>
                      <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-cyan-400 flex items-center gap-3">
                        Carbon Credit Marketplace
                        <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-900 bg-emerald-400 px-2 py-0.5 rounded-full flex items-center gap-1 shadow-[0_0_10px_rgba(52,211,153,0.5)]">
                          <ShieldCheck className="h-3 w-3" /> KYC Verified
                        </span>
                      </h2>
                      <p className="text-slate-400 mt-2">Purchase high-quality, tokenized energy efficiency offsets.</p>
                    </div>
                    <div className="bg-emerald-900/40 border border-emerald-500/30 rounded-xl p-4 text-right min-w-[200px]">
                      <p className="text-emerald-400/80 text-xs font-bold uppercase tracking-wider mb-1">Corporate Wallet Balance</p>
                      <p className="text-3xl font-black text-white">€{walletBalance.toLocaleString('en-EU', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p>
                    </div>
                  </div>
                  
                  <Tabs defaultValue="marketplace" className="w-full mt-6">
                    <TabsList className="bg-black/50 border border-white/10 p-1 mb-6">
                      <TabsTrigger value="marketplace" className="data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-400">Marketplace</TabsTrigger>
                      {role === 'Market Buyer' && (
                        <TabsTrigger value="portfolio" className="data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-400">My Portfolio</TabsTrigger>
                      )}
                    </TabsList>

                    <TabsContent value="marketplace" className="pt-2">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {marketplaceCredits.filter(c => c.status !== 'sold').map((c) => (
                          <div key={c.id} className="relative group p-[1px] rounded-2xl bg-gradient-to-b from-white/10 to-transparent hover:from-emerald-500/50 transition-colors duration-500">
                            <div className="h-full bg-slate-900/90 backdrop-blur-xl rounded-2xl p-6 flex flex-col justify-between">
                              <div>
                                <div className="flex flex-wrap gap-2 items-center mb-4">
                                  <span className="text-[10px] font-black tracking-wider uppercase px-2.5 py-1 bg-emerald-500/10 text-emerald-400 rounded border border-emerald-500/20">
                                    Verified Token
                                  </span>
                                  <span className="text-[10px] font-black tracking-wider uppercase px-2.5 py-1 bg-cyan-500/10 text-cyan-400 rounded border border-cyan-500/20">
                                    CCP-Ready
                                  </span>
                                  <span className="text-[10px] font-black tracking-wider uppercase px-2.5 py-1 bg-purple-500/10 text-purple-400 rounded border border-purple-500/20">
                                    ERC-1155
                                  </span>
                                </div>
                                <h4 className="font-bold text-lg text-white mb-2 leading-tight">{c.projectId} <span className="text-sm text-slate-400 font-normal ml-2">Batch #{c.id}</span></h4>
                                <div className="flex items-center gap-2 text-slate-400 text-sm mb-4">
                                  <Factory className="h-4 w-4" />
                                  <span>Scope 2 Reductions</span>
                                </div>
                                <div className="flex items-center gap-2 text-slate-500 text-xs mb-4 font-mono bg-black/40 p-2 rounded-lg border border-white/5">
                                  <span>Vintage: {c.vintage}</span>
                                  <span className="text-white/20">|</span>
                                  <span className="truncate" title={c.registryId}>{c.registryId}</span>
                                </div>
                              </div>
                              
                              <div className="pt-4 border-t border-white/10">
                                <div className="flex justify-between items-end mb-4">
                                  <div>
                                    <p className="text-xs text-slate-500 uppercase tracking-wide font-semibold mb-1">Volume</p>
                                    <div className="text-2xl font-bold text-white">{c.tCO2e} <span className="text-sm font-normal text-slate-400">tCO₂e</span></div>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-xs text-slate-500 uppercase tracking-wide font-semibold mb-1">Price</p>
                                    <div className="text-xl font-bold text-emerald-400">€{c.price.toFixed(2)} <span className="text-sm font-normal text-slate-400">/ t</span></div>
                                  </div>
                                </div>
                                
                                {isPaused ? (
                                  <Button disabled className="w-full bg-red-500/10 text-red-500 border border-red-500/20 font-bold shadow-none flex items-center justify-center gap-2">
                                    <AlertTriangle className="h-4 w-4" /> CONTRACT PAUSED
                                  </Button>
                                ) : (
                                  <div className="space-y-2">
                                    <Button variant="outline" className="w-full border-white/10 text-slate-300 hover:bg-white/5 hover:text-white" onClick={() => handleViewAuditLog(c.id)}>
                                      View Audit History
                                    </Button>
                                    {c.status === 'transferred' ? (
                                      <Button disabled className="w-full bg-slate-800 text-slate-500 font-bold h-10">
                                        Transferred (Not Listed)
                                      </Button>
                                    ) : c.status === 'listed' && c.ownerId === 'buyer' ? (
                                      <Button onClick={() => handleCancelListing(c.id)} className="w-full bg-red-900/50 hover:bg-red-900/80 text-red-200 border border-red-500/30 font-bold h-10">
                                        Cancel Listing
                                      </Button>
                                    ) : (
                                      <Button 
                                        onClick={() => handleBuy(c.id)} 
                                        className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold h-10 shadow-lg"
                                      >
                                        Purchase Credit
                                      </Button>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </TabsContent>

                    <TabsContent value="portfolio" className="pt-2">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {marketplaceCredits.filter(c => c.status === 'sold' || c.status === 'retired' || (c.status === 'listed' && c.ownerId === 'buyer')).length === 0 ? (
                          <div className="col-span-full flex flex-col items-center justify-center p-12 border border-dashed border-white/20 rounded-xl bg-white/5 mt-4">
                            <Leaf className="h-12 w-12 text-slate-500 mx-auto mb-4 opacity-50" />
                            <p className="text-slate-400 font-medium">Your portfolio is empty</p>
                            <p className="text-slate-500 text-sm mt-1">Purchase and hold carbon credits from the marketplace to build your portfolio.</p>
                          </div>
                        ) : (
                          marketplaceCredits.filter(c => c.status === 'sold' || c.status === 'retired' || (c.status === 'listed' && c.ownerId === 'buyer')).map((c) => (
                            <div key={c.id} className="relative group p-[1px] rounded-2xl bg-gradient-to-b from-white/10 to-transparent hover:from-emerald-500/50 transition-colors duration-500 opacity-90">
                              <div className="h-full bg-slate-900/90 backdrop-blur-xl rounded-2xl p-6 flex flex-col justify-between border-2 border-emerald-500/20">
                                <div>
                                  <div className="flex flex-wrap gap-2 items-center mb-4">
                                    {c.status === 'retired' ? (
                                      <span className="text-[10px] font-black tracking-wider uppercase px-2.5 py-1 bg-red-500/10 text-red-400 rounded border border-red-500/20">Retired</span>
                                    ) : c.status === 'listed' ? (
                                      <span className="text-[10px] font-black tracking-wider uppercase px-2.5 py-1 bg-blue-500/10 text-blue-400 rounded border border-blue-500/20">Listed on Market</span>
                                    ) : (
                                      <span className="text-[10px] font-black tracking-wider uppercase px-2.5 py-1 bg-emerald-500/10 text-emerald-400 rounded border border-emerald-500/20">Owned</span>
                                    )}
                                  </div>
                                  <h4 className="font-bold text-lg text-white mb-2 leading-tight">{c.projectId}</h4>
                                  <div className="flex items-center gap-2 text-slate-400 text-sm mb-4">
                                    <Factory className="h-4 w-4" />
                                    <span>Scope 2 Reductions</span>
                                  </div>
                                  <div className="flex items-center gap-2 text-slate-500 text-xs mb-4 font-mono bg-black/40 p-2 rounded-lg border border-white/5">
                                    <span>Vintage: {c.vintage}</span>
                                    <span className="text-white/20">|</span>
                                    <span className="truncate" title={c.registryId}>{c.registryId}</span>
                                  </div>
                                </div>
                                
                                <div className="pt-4 border-t border-white/10">
                                  <div className="flex justify-between items-end mb-4">
                                    <div>
                                      <p className="text-xs text-slate-500 uppercase tracking-wide font-semibold mb-1">Volume</p>
                                      <div className="text-2xl font-bold text-white">{c.tCO2e} <span className="text-sm font-normal text-slate-400">tCO₂e</span></div>
                                    </div>
                                  </div>
                                  
                                  <Button variant="outline" className="w-full border-white/10 text-slate-300 hover:bg-white/5 hover:text-white mb-4" onClick={() => handleViewAuditLog(c.id)}>
                                    View Audit History
                                  </Button>
                      
                                  {c.status === 'retired' && (
                                    <Dialog>
                                      <DialogTrigger className="w-full bg-emerald-900/50 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/30 border h-10 inline-flex items-center justify-center rounded-md text-sm font-bold transition-colors">
                                        View Retirement Certificate
                                      </DialogTrigger>
                                      <DialogContent className="bg-slate-900 text-white border-emerald-500/30 max-w-lg">
                                        <div className="p-6 border-4 border-double border-emerald-500/20 rounded-lg text-center space-y-4">
                                          <Leaf className="h-12 w-12 text-emerald-400 mx-auto" />
                                          <h2 className="text-2xl font-black text-white tracking-widest uppercase">Retirement Certificate</h2>
                                          <p className="text-slate-300 text-sm">This certifies that <strong className="text-emerald-400">{c.tCO2e} tCO₂e</strong> of carbon credits have been permanently retired.</p>
                                          <div className="bg-black/40 p-4 rounded-lg text-left text-sm space-y-2 border border-white/5">
                                            <p><span className="text-slate-500 w-24 inline-block">Beneficiary:</span> <strong className="text-white">{c.beneficiary || 'Confidential'}</strong></p>
                                            <p><span className="text-slate-500 w-24 inline-block">Purpose:</span> <strong className="text-white">{c.purpose || 'Confidential'}</strong></p>
                                            <p><span className="text-slate-500 w-24 inline-block">Project:</span> <strong className="text-white">{c.projectId}</strong></p>
                                            <p><span className="text-slate-500 w-24 inline-block">Registry ID:</span> <strong className="font-mono text-emerald-400">{c.registryId}</strong></p>
                                            <p><span className="text-slate-500 w-24 inline-block">Retired On:</span> <strong className="text-white">{new Date().toLocaleDateString()}</strong></p>
                                          </div>
                                          <div className="inline-block px-3 py-1 bg-red-500/10 text-red-400 text-xs font-bold uppercase tracking-widest border border-red-500/20 rounded">
                                            Permanently Non-Transferable
                                          </div>
                                        </div>
                                      </DialogContent>
                                    </Dialog>
                                  )}
                      
                                  {c.status === 'listed' && c.ownerId === 'buyer' && (
                                    <Button onClick={() => handleCancelListing(c.id)} className="w-full bg-red-900/50 hover:bg-red-900/80 text-red-200 border border-red-500/30 font-bold h-10">
                                      Cancel Listing
                                    </Button>
                                  )}
                      
                                  {c.status === 'sold' && (
                                    <div className="flex flex-col gap-2">
                                      <Dialog>
                                        <DialogTrigger className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold h-10 inline-flex items-center justify-center rounded-md text-sm">
                                          Retire Credit
                                        </DialogTrigger>
                                        <DialogContent className="bg-slate-900 text-white border-white/10 max-w-md">
                                          <DialogHeader>
                                            <DialogTitle>Retire Carbon Credit</DialogTitle>
                                            <DialogDescription className="text-slate-400 pt-2">
                                              Retiring <strong className="text-emerald-400">{c.tCO2e} tCO₂e</strong>.
                                              This credit will be permanently retired. Please provide the beneficiary details.
                                            </DialogDescription>
                                          </DialogHeader>
                                          <div className="space-y-4 py-4">
                                            <div className="space-y-2">
                                              <Label htmlFor={`beneficiary-${c.id}`} className="text-slate-300">Beneficiary Name</Label>
                                              <Input 
                                                id={`beneficiary-${c.id}`} 
                                                placeholder="e.g. Microsoft Corp" 
                                                className="bg-black/50 border-white/10 text-white focus-visible:ring-emerald-500"
                                                value={retireBeneficiary}
                                                onChange={(e) => setRetireBeneficiary(e.target.value)}
                                              />
                                            </div>
                                            <div className="space-y-2">
                                              <Label htmlFor={`purpose-${c.id}`} className="text-slate-300">Retirement Purpose</Label>
                                              <Input 
                                                id={`purpose-${c.id}`} 
                                                placeholder="e.g. Q4 Scope 2 Offset" 
                                                className="bg-black/50 border-white/10 text-white focus-visible:ring-emerald-500"
                                                value={retirePurpose}
                                                onChange={(e) => setRetirePurpose(e.target.value)}
                                              />
                                            </div>
                                            <Button 
                                              onClick={() => handleRetire(c.id, retireBeneficiary, retirePurpose)} 
                                              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold h-11"
                                              disabled={!retireBeneficiary || !retirePurpose}
                                            >
                                              Confirm Retire
                                            </Button>
                                          </div>
                                        </DialogContent>
                                      </Dialog>
                      
                                      <Button onClick={() => handleRelist(c.id)} className="w-full bg-blue-900/50 hover:bg-blue-900/80 text-blue-200 border border-blue-500/30 font-bold h-10">
                                        List on Marketplace
                                      </Button>
                      
                                      <Dialog>
                                        <DialogTrigger className="w-full bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors font-bold h-10 inline-flex items-center justify-center rounded-md text-sm border border-slate-600">
                                          Transfer
                                        </DialogTrigger>
                                        <DialogContent className="bg-slate-900 text-white border-white/10 max-w-md">
                                          <DialogHeader>
                                            <DialogTitle>Transfer Carbon Credits</DialogTitle>
                                            <DialogDescription className="text-slate-400 pt-2">
                                              Transfer <strong className="text-emerald-400">{c.tCO2e} tCO₂e</strong> to another wallet.
                                            </DialogDescription>
                                          </DialogHeader>
                                          <div className="space-y-4 py-4">
                                            <div className="space-y-2">
                                              <Label htmlFor={`recipient-${c.id}`} className="text-slate-300">Recipient Address</Label>
                                              <Input 
                                                id={`recipient-${c.id}`} 
                                                placeholder="0x..." 
                                                className="bg-black/50 border-white/10 text-white focus-visible:ring-emerald-500"
                                                value={transferRecipient}
                                                onChange={(e) => setTransferRecipient(e.target.value)}
                                              />
                                            </div>
                                            <Button 
                                              onClick={() => handleTransfer(c.id)} 
                                              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold h-11"
                                              disabled={!transferRecipient}
                                            >
                                              Confirm Transfer
                                            </Button>
                                          </div>
                                        </DialogContent>
                                      </Dialog>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </TabsContent>
                  </Tabs>
                </div>
              )}

            </div>

            {/* Sidebar Stats & Info */}
            <div className="space-y-6">
              <Card className="bg-black/60 border-white/10 backdrop-blur-xl">
                <CardHeader>
                  <CardTitle className="text-sm font-medium text-slate-400 uppercase tracking-wider">Network Status</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-300">Environment</span>
                    <span className="flex items-center gap-2 font-medium text-white bg-white/5 px-2 py-1 rounded">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span> Demo / Testnet
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-300">Blockchain</span>
                    <span className="font-medium text-purple-400">Polygon Amoy (Simulated)</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-300">Smart Contract</span>
                    <span className="font-medium text-emerald-400 font-mono text-xs">0x4F...9e2B</span>
                  </div>
                  
                  {role !== 'Admin' ? (
                    <div className="pt-4 border-t border-white/10 mt-4">
                      <Button onClick={handleClaimAdmin} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold h-10 shadow-lg shadow-indigo-500/20">
                        Login as Admin
                      </Button>
                    </div>
                  ) : (
                    <div className="pt-4 border-t border-white/10 mt-4">
                      <Button onClick={() => setRole('Project Developer')} className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold h-10">
                        Log Out
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-emerald-900/20 to-teal-900/20 border-emerald-500/20">
                <CardHeader>
                  <CardTitle className="text-sm font-medium text-emerald-400 uppercase tracking-wider flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" />
                    Compliance Engine
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-slate-300 space-y-3">
                  <div className="mb-5 bg-amber-500/10 border border-amber-500/20 p-3 rounded-lg flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-400">
                      <strong className="font-semibold tracking-wide">IMPORTANT:</strong> The Avoided tCO₂e values shown in the app are <strong>estimated calculations</strong> based on raw energy data. They are <strong>NOT verified carbon credits</strong> until an independent verifier and recognized registry confirm them.
                    </p>
                  </div>
                  <p className="flex items-start gap-2">
                    <Zap className="h-4 w-4 text-emerald-400 mt-0.5 shrink-0" />
                    <span>Calculations adhere to <strong>IPMVP Option C</strong> building efficiency standards.</span>
                  </p>
                  <p className="flex items-start gap-2">
                    <Zap className="h-4 w-4 text-emerald-400 mt-0.5 shrink-0" />
                    <span>Uses verified 2025/2026 emission factors from <strong>SEAI</strong> and <strong>DEFRA</strong>.</span>
                  </p>

                </CardContent>
              </Card>
            </div>
            
          </div>
        </div>

        {/* Test runner removed per request */}

        <Dialog open={isAuditLogOpen} onOpenChange={setIsAuditLogOpen}>
          <DialogContent className="bg-slate-900 text-white border-white/10 max-w-2xl">
            <DialogHeader>
              <DialogTitle>Project Audit Trail</DialogTitle>
              <DialogDescription className="text-slate-400">Complete history of state transitions and notes.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
              {auditLogs.length === 0 ? (
                <p className="text-slate-500 text-sm">No audit logs found for this project.</p>
              ) : (
                <div className="relative border-l border-white/10 ml-3 space-y-6">
                  {auditLogs.map((log, idx) => (
                    <div key={idx} className="relative pl-6">
                      <div className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full bg-emerald-500 ring-4 ring-slate-900" />
                      <div className="text-sm font-medium text-white mb-1">
                        State changed: <span className="text-slate-400">{log.from_status || 'null'}</span> &rarr; <span className="text-emerald-400">{log.to_status}</span>
                      </div>
                      <div className="text-xs text-slate-500 mb-2">
                        {new Date(log.timestamp).toLocaleString()} by <strong className="text-slate-300">{log.actor}</strong>
                      </div>
                      <div className="text-sm text-slate-300 bg-white/5 p-3 rounded border border-white/10">
                        {log.notes}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

      <Dialog open={isCertificateOpen} onOpenChange={setIsCertificateOpen}>
        <DialogContent className="bg-slate-900 text-white border-emerald-500/30 max-w-2xl" id="certificate-modal">
          {retiredCredit && (
            <div className="p-8 border-[6px] border-double border-emerald-500/20 rounded-lg text-center space-y-6 relative bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-800 to-slate-900">
              
              <div className="absolute top-6 left-6 text-emerald-500/30">
                <Leaf className="h-16 w-16" />
              </div>
              <div className="absolute top-6 right-6 text-emerald-500/30">
                <ShieldCheck className="h-16 w-16" />
              </div>

              <div className="pt-8">
                <h2 className="text-4xl font-black text-white tracking-widest uppercase mb-2 font-serif">Certificate of Retirement</h2>
                <div className="h-1 w-32 bg-emerald-500 mx-auto rounded-full mb-6"></div>
                <p className="text-slate-300 text-lg">This document certifies that</p>
                <p className="text-4xl font-bold text-emerald-400 my-4 uppercase">{retiredCredit.beneficiary}</p>
                <p className="text-slate-300 text-lg">has permanently retired</p>
                <p className="text-3xl font-black text-white my-4 bg-emerald-900/50 inline-block px-6 py-2 rounded-xl border border-emerald-500/30">{retiredCredit.tCO2e} <span className="text-xl font-normal text-emerald-100/70">Verified Carbon Units (tCO₂e)</span></p>
              </div>
              
              <div className="grid grid-cols-2 gap-4 text-left bg-black/40 p-6 rounded-lg border border-white/5 relative overflow-hidden">
                <div className="absolute -right-12 -bottom-12 h-32 w-32 border-4 border-red-500/40 rounded-full flex items-center justify-center rotate-[-15deg] opacity-80 pointer-events-none">
                  <div className="border-2 border-red-500/40 rounded-full h-28 w-28 flex items-center justify-center">
                    <span className="text-red-500/60 font-black tracking-widest uppercase text-xl">RETIRED</span>
                  </div>
                </div>

                <div className="space-y-4 relative z-10">
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-widest font-bold">Purpose</p>
                    <p className="text-white font-medium">{retiredCredit.purpose}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-widest font-bold">Project Origin</p>
                    <p className="text-white font-medium">{retiredCredit.projectId}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-widest font-bold">Registry ID</p>
                    <p className="text-emerald-400 font-mono text-sm">{retiredCredit.registryId}</p>
                  </div>
                </div>
                <div className="space-y-4 relative z-10">
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-widest font-bold">Vintage Year</p>
                    <p className="text-white font-medium">{retiredCredit.vintage}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-widest font-bold">Date of Retirement</p>
                    <p className="text-white font-medium">{new Date(retiredCredit.timestamp).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-widest font-bold">Transaction Hash</p>
                    <p className="text-slate-400 font-mono text-xs break-all">0x{Array.from(retiredCredit.projectId || 'demo').map(c => String(c).charCodeAt(0).toString(16).padStart(2,'0')).join('').padEnd(64, '0')}</p>
                  </div>
                </div>
              </div>

              <div className="text-xs text-slate-500 text-left px-6 py-2">
                * Upon retirement, the corresponding immobilized credit on the external Registry is simultaneously marked retired via API sync.
              </div>

              <div className="pt-4 flex justify-center gap-4">
                <Button variant="outline" className="border-white/10 text-slate-300 hover:bg-white/5" onClick={() => setIsCertificateOpen(false)}>
                  Close
                </Button>
                <Button 
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                  onClick={() => {
                    const printContents = document.getElementById('certificate-modal')?.innerHTML;
                    if (printContents) {
                      const printWindow = window.open('', '_blank');
                      if (printWindow) {
                        printWindow.document.write(`
                          <html>
                            <head>
                              <title>EclimAi Retirement Certificate</title>
                              <script src="https://cdn.tailwindcss.com"></script>
                              <style>
                                body { background-color: #0f172a; color: white; padding: 40px; }
                                @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
                              </style>
                            </head>
                            <body>
                              ${printContents.replace(/<button[^>]*>.*?<\/button>/gi, '')}
                              <script>
                                setTimeout(() => { window.print(); window.close(); }, 500);
                              </script>
                            </body>
                          </html>
                        `);
                        printWindow.document.close();
                      }
                    }
                  }}
                >
                  <Download className="mr-2 h-4 w-4" /> Download as PDF
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      </main>
    </TooltipProvider>
  );
}
