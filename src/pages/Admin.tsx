import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowLeft, Save, RefreshCw, Settings, Lock, LogIn, Newspaper, Plus, Trash2, Pencil, Pin, Globe, Clock, Zap, Radio, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import SegmentedSwitch from "@/components/SegmentedSwitch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { getHeadlines, triggerFetch, getAggregatorStatus, type HeadlinesResponse, type AggregatorStatus, type HeadlineItem } from "@/lib/newsapi-service";

const PROVIDER_LABELS: Record<string, { label: string; color: string }> = {
    newsapi: { label: 'NewsAPI', color: 'text-orange-500' },
    newsdata: { label: 'NewsData', color: 'text-cyan-500' },
    gnews: { label: 'GNews', color: 'text-emerald-500' },
};

const REGION_BADGES: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
    nigeria: { label: '🇳🇬 Nigeria', variant: 'default' },
    africa: { label: '🌍 Africa', variant: 'secondary' },
    world: { label: '🌐 World', variant: 'outline' },
};

const Admin = () => {
    const [overrideEnabled, setOverrideEnabled] = useState(false);
    const [overrideMessage, setOverrideMessage] = useState("");
    const [scrollType, setScrollType] = useState<"information" | "news">("information");
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [news, setNews] = useState<any[]>([]);
    const [isAuthenticated, setIsAuthenticated] = useState(!!sessionStorage.getItem("admin_password"));
    const [password, setPassword] = useState("");
    const [isNewsDialogOpen, setIsNewsDialogOpen] = useState(false);
    const [editingNews, setEditingNews] = useState<any>(null);
    const [newsForm, setNewsForm] = useState({ title: "", content: "", status: "Published", pinned: false });

    // News Aggregator state
    const [headlinesData, setHeadlinesData] = useState<HeadlinesResponse | null>(null);
    const [aggStatus, setAggStatus] = useState<AggregatorStatus | null>(null);
    const [isFetchingHeadlines, setIsFetchingHeadlines] = useState(false);
    const [selectedProvider, setSelectedProvider] = useState<string>('');

    const navigate = useNavigate();

    const getAuthHeader = () => ({
        'Authorization': `Bearer ${sessionStorage.getItem("admin_password") || ""}`
    });

    const fetchConfig = async () => {
        if (!isAuthenticated) return;
        setIsLoading(true);
        try {
            const response = await fetch('/api/scroll', { headers: getAuthHeader() });
            if (response.ok) {
                const data = await response.json();
                setOverrideEnabled(data.overrideEnabled);
                setOverrideMessage(data.overrideMessage || "");
                setScrollType(data.scrollType || "information");
            } else if (response.status === 401) {
                const errData = await response.json().catch(() => ({}));
                let diagMsg = "";
                if (errData.diagnostic) {
                    const { providedLength, expectedLength, hasEnv } = errData.diagnostic;
                    diagMsg = ` (Sent: ${providedLength}, Expected: ${expectedLength}, EnvSet: ${hasEnv})`;
                }
                toast.error(`Unauthorized${diagMsg}. Check password.`);
                setIsAuthenticated(false);
            } else if (response.status === 404) {
                toast.error("API endpoint not found (404). Check Nginx config.");
            } else {
                toast.error(`API Error: ${response.status} ${response.statusText}`);
            }
        } catch (error) {
            console.error("Error fetching config:", error);
            toast.error("Connecting failed. Is the API server running?");
        } finally {
            setIsLoading(false);
        }
    };

    const fetchSubmissions = async () => {
        if (!isAuthenticated) return;
        try {
            const [newsRes] = await Promise.all([
                fetch('/api/news', { headers: getAuthHeader() })
            ]);
            if (newsRes.status === 401) { setIsAuthenticated(false); return; }
            if (newsRes.ok) setNews(await newsRes.json());
        } catch (error) {
            console.error("Error fetching submissions:", error);
        }
    };

    const handleSaveNews = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            const method = editingNews ? "PUT" : "POST";
            const response = await fetch('/api/news', {
                method,
                headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
                body: JSON.stringify(editingNews ? { ...newsForm, id: editingNews.id } : newsForm)
            });
            if (response.ok) {
                toast.success(`News ${editingNews ? 'updated' : 'added'} successfully`);
                setIsNewsDialogOpen(false);
                setEditingNews(null);
                setNewsForm({ title: "", content: "", status: "Published", pinned: false });
                fetchSubmissions();
            } else {
                const errData = await response.json().catch(() => ({}));
                toast.error(errData.error || "Failed to save news");
            }
        } catch (error) {
            toast.error("Error saving news");
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteNews = async (id: string) => {
        if (!confirm("Are you sure you want to delete this news item?")) return;
        try {
            const response = await fetch(`/api/news?id=${id}`, { method: "DELETE", headers: getAuthHeader() });
            if (response.ok) { toast.success("News deleted"); fetchSubmissions(); }
        } catch (error) {
            toast.error("Error deleting news");
        }
    };

    const openEditNews = (item: any) => {
        setEditingNews(item);
        setNewsForm({ title: item.title, content: item.content, status: item.status, pinned: item.pinned });
        setIsNewsDialogOpen(true);
    };

    // ── News Aggregator functions ──
    const loadHeadlines = useCallback(async () => {
        try {
            const data = await getHeadlines();
            setHeadlinesData(data);
        } catch (e) {
            console.error('Failed to load headlines:', e);
        }
    }, []);

    const loadAggStatus = useCallback(async () => {
        try {
            const status = await getAggregatorStatus();
            setAggStatus(status);
        } catch (e) {
            console.error('Failed to load aggregator status:', e);
        }
    }, []);

    const handleManualFetch = async () => {
        setIsFetchingHeadlines(true);
        try {
            const result = await triggerFetch(selectedProvider || undefined);
            if (result.success) {
                toast.success(`Fetched ${result.fetched} headlines from ${PROVIDER_LABELS[result.provider]?.label || result.provider}`);
                loadHeadlines();
                loadAggStatus();
            } else {
                toast.error(`Fetch failed: ${result.error}`);
            }
        } catch (error: any) {
            toast.error(`Fetch error: ${error.message}`);
        } finally {
            setIsFetchingHeadlines(false);
        }
    };

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        if (password) {
            sessionStorage.setItem("admin_password", password.trim());
            setIsAuthenticated(true);
        }
    };

    const handleLogout = () => {
        sessionStorage.removeItem("admin_password");
        setIsAuthenticated(false);
        setPassword("");
    };

    useEffect(() => {
        if (isAuthenticated) {
            fetchConfig();
            fetchSubmissions();
            loadHeadlines();
            loadAggStatus();
            // Refresh headlines every 2 minutes
            const iv = setInterval(() => { loadHeadlines(); loadAggStatus(); }, 2 * 60 * 1000);
            return () => clearInterval(iv);
        }
    }, [isAuthenticated, loadHeadlines, loadAggStatus]);

    const handleSave = async () => {
        if (overrideMessage.length > 2000) { toast.error("Message too long (max 2000 characters)"); return; }
        setIsSaving(true);
        try {
            const response = await fetch('/api/scroll', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
                body: JSON.stringify({ overrideEnabled, overrideMessage: overrideMessage.trim(), scrollType })
            });
            if (response.ok) { toast.success("Settings updated successfully!"); }
            else if (response.status === 401) {
                const errorData = await response.json().catch(() => ({}));
                let diagMsg = "";
                if (errorData.diagnostic) { const { providedLength, expectedLength, hasEnv } = errorData.diagnostic; diagMsg = ` (Sent: ${providedLength}, Expected: ${expectedLength}, EnvSet: ${hasEnv})`; }
                toast.error(`Unauthorized${diagMsg}. Please check your password.`);
                setIsAuthenticated(false);
            } else {
                const errorData = await response.json().catch(() => ({}));
                toast.error(errorData.error || `Failed to save settings (${response.status})`);
            }
        } catch (error) {
            console.error("Error saving config:", error);
            toast.error("Connecting failed. Is the API server running?");
        } finally { setIsSaving(false); }
    };

    return (
        <div className="h-full w-full max-w-[420px] mx-auto flex flex-col">
            <div className="h-full w-full overflow-y-auto overflow-x-hidden flex-grow">
                <div className="h-full w-full py-4 px-4 space-y-6 flex flex-col">
                    <header className="flex items-center justify-between">
                        <Button variant="ghost" onClick={() => navigate("/")} className="gap-2 text-xs sm:text-sm">
                            <ArrowLeft className="w-4 h-4" /> Back to Player
                        </Button>
                        <h1 className="text-2xl font-bold">Admin</h1>
                        <div className="flex gap-2">
                            {isAuthenticated && (
                                <Button variant="outline" size="sm" onClick={handleLogout} className="text-xs">Logout</Button>
                            )}
                            <Button variant="outline" size="icon" onClick={() => { fetchConfig(); fetchSubmissions(); loadHeadlines(); loadAggStatus(); }} disabled={isLoading || !isAuthenticated}>
                                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                            </Button>
                        </div>
                    </header>

                    {!isAuthenticated ? (
                        <div className="flex flex-col items-center justify-center pt-20">
                            <Card className="w-full">
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <Lock className="w-5 h-5 text-primary" /> Admin Login
                                    </CardTitle>
                                    <CardDescription>Enter your password to access dashboard</CardDescription>
                                </CardHeader>
                                <form onSubmit={handleLogin}>
                                    <CardContent className="space-y-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="password">Password</Label>
                                            <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter admin password" autoFocus />
                                        </div>
                                    </CardContent>
                                    <CardFooter>
                                        <Button type="submit" className="w-full gap-2"><LogIn className="w-4 h-4" /> Login</Button>
                                    </CardFooter>
                                </form>
                            </Card>
                        </div>
                    ) : (
                        <Tabs defaultValue="scroll" className="w-full">
                            <TabsList className="grid w-full grid-cols-3 mb-8">
                                <TabsTrigger value="scroll" className="gap-1 text-xs sm:text-sm">
                                    <Settings className="w-3 h-3" /> Scroll
                                </TabsTrigger>
                                <TabsTrigger value="headlines" className="gap-1 text-xs sm:text-sm">
                                    <Globe className="w-3 h-3" /> Headlines
                                    {headlinesData && headlinesData.stats.total > 0 && (
                                        <Badge variant="secondary" className="ml-1 px-1 py-0 min-w-[1.2rem] h-4 justify-center text-[10px]">
                                            {headlinesData.stats.total}
                                        </Badge>
                                    )}
                                </TabsTrigger>
                                <TabsTrigger value="news" className="gap-1 text-xs sm:text-sm">
                                    <Newspaper className="w-3 h-3" /> Manual
                                    {news.length > 0 && (
                                        <Badge variant="secondary" className="ml-1 px-1 py-0 min-w-[1.2rem] h-4 justify-center text-[10px]">
                                            {news.length}
                                        </Badge>
                                    )}
                                </TabsTrigger>
                            </TabsList>

                            {/* ── SCROLL TAB ── */}
                            <TabsContent value="scroll" className="space-y-6">
                                <main className="space-y-6 bg-card p-4 rounded-xl border border-border shadow-sm">
                                    <div className="space-y-4">
                                        <div className="space-y-2 pb-4 border-b border-border">
                                            <Label className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Scroll Content Type</Label>
                                            <SegmentedSwitch
                                                options={[{ label: "Information", value: "information" }, { label: "News", value: "news" }]}
                                                activeValue={scrollType}
                                                onChange={(val) => setScrollType(val as any)}
                                            />
                                        </div>
                                        <div className="flex items-center justify-between pb-4 border-b border-border">
                                            <div className="space-y-0.5">
                                                <Label htmlFor="override-toggle" className="text-base font-semibold">Enable Information Scroll Override</Label>
                                                <p className="text-sm text-muted-foreground">When enabled, this message replaces the live Artist/Song metadata.</p>
                                            </div>
                                            <Switch id="override-toggle" checked={overrideEnabled} onCheckedChange={setOverrideEnabled} />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="message" className="text-sm font-medium">Override Message</Label>
                                            <Textarea id="message" placeholder="e.g. Welcome to Freedom Naija Radio!" value={overrideMessage} onChange={(e) => setOverrideMessage(e.target.value)} className="min-h-[120px] resize-none" maxLength={2000} />
                                            <div className="text-right text-xs text-muted-foreground">{overrideMessage.length}/2000 characters</div>
                                        </div>
                                    </div>
                                    <Button className="w-full gap-2 h-12 text-base font-bold" onClick={handleSave} disabled={isSaving}>
                                        {isSaving ? <><RefreshCw className="w-4 h-4 animate-spin" /> Saving...</> : <><Save className="w-4 h-4" /> Save & Update Scroll</>}
                                    </Button>
                                </main>
                                <section className="p-4 bg-muted/30 rounded-lg border border-border/50">
                                    <h2 className="text-sm font-semibold mb-2">Live App Status</h2>
                                    <div className="text-xs space-y-1">
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Status:</span>
                                            <span className={overrideEnabled ? "text-primary font-bold" : "text-muted-foreground"}>
                                                {overrideEnabled ? `ACTIVE (${scrollType.toUpperCase()})` : "METADATA ACTIVE"}
                                            </span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">API Connection:</span>
                                            <span className="text-emerald-500 font-medium">Online</span>
                                        </div>
                                    </div>
                                </section>
                            </TabsContent>

                            {/* ── HEADLINES TAB (News Aggregator) ── */}
                            <TabsContent value="headlines" className="space-y-4 text-left">
                                {/* Aggregator Status Card */}
                                <Card className="border-blue-500/30 bg-gradient-to-br from-blue-500/5 to-purple-500/5">
                                    <CardHeader className="pb-3">
                                        <CardTitle className="text-base flex items-center gap-2">
                                            <Radio className="w-5 h-5 text-blue-500 animate-pulse" />
                                            Eternal News Scroll
                                        </CardTitle>
                                        <CardDescription className="text-xs">
                                            Auto-aggregates headlines from <strong>3 sources</strong>, rotating every <strong>10 minutes</strong>.
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-3">
                                        {/* Provider Rotation Status */}
                                        <div className="grid grid-cols-3 gap-2">
                                            {aggStatus?.providerRotation?.map((p) => (
                                                <div key={p.name} className={`p-2 rounded-lg border text-center text-[10px] transition-all ${p.isCurrent ? 'border-blue-500/50 bg-blue-500/10 ring-1 ring-blue-500/30' : p.isNext ? 'border-yellow-500/30 bg-yellow-500/5' : 'border-border/50 bg-muted/20'}`}>
                                                    <div className={`font-bold ${PROVIDER_LABELS[p.name]?.color || ''}`}>
                                                        {PROVIDER_LABELS[p.name]?.label || p.name}
                                                    </div>
                                                    <div className="mt-0.5">
                                                        {p.isCurrent ? <Badge variant="default" className="text-[8px] h-4 px-1">CURRENT</Badge>
                                                            : p.isNext ? <Badge variant="outline" className="text-[8px] h-4 px-1 border-yellow-500/50 text-yellow-600">NEXT</Badge>
                                                                : <span className="text-muted-foreground">Idle</span>}
                                                    </div>
                                                    {p.lastError ? (
                                                        <div className="mt-1 flex items-center justify-center gap-0.5 text-destructive">
                                                            <XCircle className="w-2.5 h-2.5" />
                                                            <span className="truncate max-w-[60px]">Error</span>
                                                        </div>
                                                    ) : aggStatus?.keysConfigured?.[p.name as keyof typeof aggStatus.keysConfigured] ? (
                                                        <div className="mt-1 flex items-center justify-center gap-0.5 text-emerald-500">
                                                            <CheckCircle2 className="w-2.5 h-2.5" />
                                                            <span>Ready</span>
                                                        </div>
                                                    ) : (
                                                        <div className="mt-1 flex items-center justify-center gap-0.5 text-yellow-500">
                                                            <AlertTriangle className="w-2.5 h-2.5" />
                                                            <span>No Key</span>
                                                        </div>
                                                    )}
                                                </div>
                                            )) || (
                                                    <div className="col-span-3 text-center text-xs text-muted-foreground py-2">Loading status...</div>
                                                )}
                                        </div>

                                        {/* Stats */}
                                        <div className="grid grid-cols-4 gap-2 pt-2 border-t border-border/50">
                                            <div className="text-center">
                                                <div className="text-lg font-bold">{headlinesData?.stats?.total || 0}</div>
                                                <div className="text-[10px] text-muted-foreground">Total</div>
                                            </div>
                                            <div className="text-center">
                                                <div className="text-lg font-bold text-emerald-500">{headlinesData?.stats?.nigeria || 0}</div>
                                                <div className="text-[10px] text-muted-foreground">🇳🇬 Nigeria</div>
                                            </div>
                                            <div className="text-center">
                                                <div className="text-lg font-bold text-blue-500">{headlinesData?.stats?.africa || 0}</div>
                                                <div className="text-[10px] text-muted-foreground">🌍 Africa</div>
                                            </div>
                                            <div className="text-center">
                                                <div className="text-lg font-bold text-purple-500">{headlinesData?.stats?.world || 0}</div>
                                                <div className="text-[10px] text-muted-foreground">🌐 World</div>
                                            </div>
                                        </div>

                                        {/* Last updated */}
                                        <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1">
                                            <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> Last updated:</span>
                                            <span className="font-mono">{headlinesData?.lastUpdated ? new Date(headlinesData.lastUpdated).toLocaleString() : 'Never'}</span>
                                        </div>
                                    </CardContent>
                                    <CardFooter className="flex gap-2">
                                        <Select value={selectedProvider} onValueChange={setSelectedProvider}>
                                            <SelectTrigger className="w-[120px] h-8 text-xs">
                                                <SelectValue placeholder="Auto" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="auto">Auto (Next)</SelectItem>
                                                <SelectItem value="newsapi">NewsAPI</SelectItem>
                                                <SelectItem value="newsdata">NewsData</SelectItem>
                                                <SelectItem value="gnews">GNews</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <Button
                                            size="sm"
                                            className="flex-1 gap-2"
                                            onClick={handleManualFetch}
                                            disabled={isFetchingHeadlines}
                                        >
                                            {isFetchingHeadlines ? (
                                                <><RefreshCw className="w-3 h-3 animate-spin" /> Fetching...</>
                                            ) : (
                                                <><Zap className="w-3 h-3" /> Fetch Now</>
                                            )}
                                        </Button>
                                    </CardFooter>
                                </Card>

                                {/* Headlines List */}
                                <div className="space-y-2 pb-8">
                                    <h3 className="text-sm font-semibold flex items-center gap-2 px-1">
                                        <Newspaper className="w-4 h-4 text-primary" />
                                        Live Headlines ({headlinesData?.fullHeadlines?.length || 0})
                                    </h3>
                                    {!headlinesData?.fullHeadlines?.length ? (
                                        <div className="text-center py-8 text-muted-foreground bg-card rounded-xl border border-dashed border-border text-xs">
                                            No headlines yet. Click "Fetch Now" or wait for auto-rotation.
                                        </div>
                                    ) : (
                                        headlinesData.fullHeadlines.map((h: HeadlineItem, i: number) => (
                                            <Card key={h.id || i} className={`transition-all hover:shadow-sm ${h.region === 'nigeria' ? 'border-l-2 border-l-emerald-500' : h.region === 'africa' ? 'border-l-2 border-l-blue-500' : 'border-l-2 border-l-purple-500'}`}>
                                                <CardContent className="p-3">
                                                    <div className="flex items-start justify-between gap-2">
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-medium leading-tight line-clamp-2">{h.title}</p>
                                                            {h.summary && <p className="text-[10px] text-muted-foreground mt-1 line-clamp-1">{h.summary}</p>}
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                                                        <Badge variant={REGION_BADGES[h.region]?.variant || 'outline'} className="text-[9px] h-4 px-1.5">
                                                            {REGION_BADGES[h.region]?.label || h.region}
                                                        </Badge>
                                                        <span className={`text-[9px] font-medium ${PROVIDER_LABELS[h.provider]?.color || ''}`}>
                                                            {PROVIDER_LABELS[h.provider]?.label || h.provider}
                                                        </span>
                                                        <span className="text-[9px] text-muted-foreground">• {h.source}</span>
                                                        <span className="text-[9px] text-muted-foreground ml-auto">
                                                            {new Date(h.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        ))
                                    )}
                                </div>
                            </TabsContent>

                            {/* ── MANUAL NEWS TAB ── */}
                            <TabsContent value="news" className="space-y-4 text-left">
                                <div className="flex justify-between items-center bg-card p-4 rounded-xl border border-border shadow-sm">
                                    <h2 className="text-lg font-bold flex items-center gap-2">
                                        <Newspaper className="w-5 h-5 text-primary" />
                                        Manual News
                                    </h2>
                                    <Dialog open={isNewsDialogOpen} onOpenChange={setIsNewsDialogOpen}>
                                        <DialogTrigger asChild>
                                            <Button size="sm" className="gap-2" onClick={() => { setEditingNews(null); setNewsForm({ title: "", content: "", status: "Published", pinned: false }); }}>
                                                <Plus className="w-4 h-4" /> Add
                                            </Button>
                                        </DialogTrigger>
                                        <DialogContent className="sm:max-w-[425px]">
                                            <DialogHeader>
                                                <DialogTitle>{editingNews ? 'Edit News' : 'Add New News Item'}</DialogTitle>
                                                <DialogDescription>Fill in the details for your news update.</DialogDescription>
                                            </DialogHeader>
                                            <form onSubmit={handleSaveNews} className="space-y-4 py-4 text-left">
                                                <div className="space-y-2">
                                                    <Label htmlFor="news-title">Title</Label>
                                                    <Input id="news-title" value={newsForm.title} onChange={e => setNewsForm({ ...newsForm, title: e.target.value })} placeholder="Breaking News..." required />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label htmlFor="news-content">Content</Label>
                                                    <Textarea id="news-content" value={newsForm.content} onChange={e => setNewsForm({ ...newsForm, content: e.target.value })} placeholder="Details..." className="min-h-[150px]" required />
                                                </div>
                                                <div className="flex items-center justify-between gap-4">
                                                    <div className="flex-1 space-y-2">
                                                        <Label>Status</Label>
                                                        <Select value={newsForm.status} onValueChange={val => setNewsForm({ ...newsForm, status: val })}>
                                                            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="Published">Published</SelectItem>
                                                                <SelectItem value="Draft">Draft</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                    <div className="flex items-center space-x-2 pt-6">
                                                        <Checkbox id="pinned" checked={newsForm.pinned} onCheckedChange={val => setNewsForm({ ...newsForm, pinned: !!val })} />
                                                        <Label htmlFor="pinned" className="text-sm font-medium leading-none cursor-pointer">Pin</Label>
                                                    </div>
                                                </div>
                                                <DialogFooter className="pt-4">
                                                    <Button type="submit" disabled={isLoading} className="w-full">
                                                        {isLoading ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                                                        {editingNews ? 'Update News' : 'Save News'}
                                                    </Button>
                                                </DialogFooter>
                                            </form>
                                        </DialogContent>
                                    </Dialog>
                                </div>

                                <div className="space-y-3 pb-8">
                                    {news.length === 0 ? (
                                        <div className="text-center py-12 text-muted-foreground bg-card rounded-xl border border-dashed border-border">
                                            No manual news items yet. Click "Add" to start.
                                        </div>
                                    ) : (
                                        news.map((item: any) => (
                                            <Card key={item.id} className={`${item.pinned ? 'border-primary/50 shadow-sm bg-primary/5' : ''}`}>
                                                <CardHeader className="pb-2">
                                                    <div className="flex justify-between items-start">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            {item.pinned && <Pin className="w-3 h-3 text-primary fill-primary" />}
                                                            <Badge variant={item.status === 'Published' ? 'default' : 'secondary'} className="text-[10px]">
                                                                {item.status.toUpperCase()}
                                                            </Badge>
                                                            <span className="text-[10px] text-muted-foreground font-mono">
                                                                {new Date(item.createdAt).toLocaleDateString()}
                                                            </span>
                                                        </div>
                                                        <div className="flex gap-1">
                                                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditNews(item)}>
                                                                <Pencil className="w-4 h-4" />
                                                            </Button>
                                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => handleDeleteNews(item.id)}>
                                                                <Trash2 className="w-4 h-4" />
                                                            </Button>
                                                        </div>
                                                    </div>
                                                    <CardTitle className="text-base line-clamp-1 mt-1">{item.title}</CardTitle>
                                                </CardHeader>
                                                <CardContent>
                                                    <p className="text-xs text-muted-foreground line-clamp-2">{item.content}</p>
                                                </CardContent>
                                            </Card>
                                        ))
                                    )}
                                </div>
                            </TabsContent>
                        </Tabs>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Admin;