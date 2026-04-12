import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowLeft, Save, RefreshCw, Settings, Lock, LogIn, Newspaper, Plus, Trash2, Pencil, Pin, Globe, Clock, Zap, Radio, AlertTriangle, CheckCircle2, XCircle, Share2, ExternalLink, Archive } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import SegmentedSwitch from "@/components/SegmentedSwitch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { getHeadlines, triggerFetch, getAggregatorStatus, deleteHeadline, updateHeadline, type HeadlinesResponse, type AggregatorStatus, type HeadlineItem } from "@/lib/newsapi-service";

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
    const [isFetchingNews, setIsFetchingNews] = useState(false);
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
    const [selectedProvider, setSelectedProvider] = useState<string>('auto');
    const [isHeadlineDialogOpen, setIsHeadlineDialogOpen] = useState(false);
    const [editingHeadline, setEditingHeadline] = useState<HeadlineItem | null>(null);
    const [headlineForm, setHeadlineForm] = useState({ title: '', summary: '', source: '' });
    const [isSavingHeadline, setIsSavingHeadline] = useState(false);

    const navigate = useNavigate();

    const getAuthHeader = useCallback(() => ({
        'Authorization': `Bearer ${sessionStorage.getItem("admin_password") || ""}`
    }), []);

    const fetchConfig = useCallback(async () => {
        if (!isAuthenticated) return;
        setIsLoading(true);
        try {
            const response = await fetch('/api/scroll', {
                headers: getAuthHeader()
            });
            if (response.ok) {
                const rawData = await response.json();
                const data = Array.isArray(rawData) ? rawData[0] : rawData;
                if (data) {
                    setOverrideEnabled(data.override_enabled ?? data.overrideEnabled ?? false);
                    setOverrideMessage(data.override_message ?? data.overrideMessage ?? "");
                    setScrollType(data.scroll_type ?? data.scrollType ?? "information");
                }
            } else if (response.status === 401) {
                toast.error("Unauthorized. Check password.");
                setIsAuthenticated(false);
            } else {
                toast.error(`API Error: ${response.status}`);
            }
        } catch (error) {
            console.error("Error fetching config:", error);
            toast.error("Connecting failed.");
        } finally {
            setIsLoading(false);
        }
    }, [isAuthenticated, getAuthHeader]);

    const fetchSubmissions = useCallback(async () => {
        if (!isAuthenticated) return;
        try {
            const newsRes = await fetch('/api/news', { headers: getAuthHeader() });
            if (newsRes.status === 401) {
                setIsAuthenticated(false);
                return;
            }
            if (newsRes.ok) setNews(await newsRes.json());
        } catch (error) {
            console.error("Error fetching submissions:", error);
        }
    }, [isAuthenticated, getAuthHeader]);

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
            const response = await fetch(`/api/news?id=${id}`, {
                method: "DELETE",
                headers: getAuthHeader()
            });
            if (response.ok) {
                toast.success("News deleted");
                fetchSubmissions();
            }
        } catch (error) {
            toast.error("Error deleting news");
        }
    };

    const openEditNews = (item: any) => {
        setEditingNews(item);
        setNewsForm({ title: item.title, content: item.content, status: item.status, pinned: item.pinned });
        setIsNewsDialogOpen(true);
    };

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
            const provider = selectedProvider === 'auto' ? undefined : selectedProvider;
            const result = await triggerFetch(provider);
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
            const trimmedPassword = password.trim();
            sessionStorage.setItem("admin_password", trimmedPassword);
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
        }
    }, [isAuthenticated, fetchConfig, fetchSubmissions, loadHeadlines, loadAggStatus]);

    const handleSave = async () => {
        if (overrideMessage.length > 2000) {
            toast.error("Message too long (max 2000 characters)");
            return;
        }

        setIsSaving(true);
        try {
            const response = await fetch('/api/scroll', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...getAuthHeader()
                },
                body: JSON.stringify({
                    overrideEnabled,
                    overrideMessage: overrideMessage.trim(),
                    scrollType
                })
            });

            if (response.ok) {
                toast.success("Settings updated successfully!");
            } else {
                toast.error(`Failed to save settings (${response.status})`);
            }
        } catch (error) {
            console.error("Error saving config:", error);
            toast.error("Connecting failed.");
        } finally {
            setIsSaving(false);
        }
    };

    const openEditHeadline = (headline: HeadlineItem) => {
        setEditingHeadline(headline);
        setHeadlineForm({ title: headline.title, summary: headline.summary, source: headline.source });
        setIsHeadlineDialogOpen(true);
    };

    const closeEditHeadline = () => {
        setIsHeadlineDialogOpen(false);
        setEditingHeadline(null);
        setHeadlineForm({ title: '', summary: '', source: '' });
    };

    const handleSaveHeadline = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingHeadline) return;
        setIsSavingHeadline(true);
        try {
            await updateHeadline(editingHeadline.id, headlineForm);
            toast.success('Headline updated successfully');
            closeEditHeadline();
            loadHeadlines();
        } catch (error: any) {
            console.error('Error updating headline:', error);
            toast.error(error?.message || 'Failed to update headline');
        } finally {
            setIsSavingHeadline(false);
        }
    };

    const handleDeleteHeadline = async (id: string) => {
        if (!confirm('Delete this headline from the live feed?')) return;
        try {
            await deleteHeadline(id);
            toast.success('Headline deleted');
            await loadHeadlines();
            await loadAggStatus();
        } catch (error: any) {
            console.error('Error deleting headline:', error);
            toast.error(error?.message || 'Failed to delete headline');
        }
    };

    const previewMessage = (scrollType === 'news' && headlinesData?.headlines?.length) 
        ? "📰 NEWS UPDATE 📰  " + headlinesData.headlines.join("  🔸  ") 
        : (overrideEnabled && overrideMessage) ? overrideMessage : "Freedom Naija Radio — Live Stream";

    return (
        <div className="min-h-screen w-full bg-background flex flex-col">
            <div className="max-w-5xl w-full mx-auto flex flex-col flex-grow">
                <div className="py-6 px-4 space-y-8">
                    <header className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-border/50 pb-6">
                        <div className="flex items-center gap-4">
                            <Button variant="ghost" onClick={() => navigate("/")} className="gap-2 h-10">
                                <ArrowLeft className="w-4 h-4" /> <span className="hidden sm:inline">Back to Player</span>
                            </Button>
                            <div>
                                <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
                                <p className="text-sm text-muted-foreground">Manage your station's live content</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            {isAuthenticated && (
                                <>
                                    <div className="hidden md:flex flex-col items-end mr-2">
                                        <span className="text-[10px] text-muted-foreground uppercase font-bold">Session</span>
                                        <span className="text-xs font-mono text-primary flex items-center gap-1">
                                            <CheckCircle2 className="w-3 h-3" /> Active
                                        </span>
                                    </div>
                                    <Button variant="outline" size="sm" onClick={handleLogout} className="h-10 hover:bg-destructive hover:text-white transition-colors">
                                        Logout
                                    </Button>
                                    <Button 
                                        variant="outline" 
                                        size="icon" 
                                        onClick={() => { fetchConfig(); fetchSubmissions(); loadHeadlines(); loadAggStatus(); }} 
                                        disabled={isLoading || !isAuthenticated}
                                        className="h-10 w-10"
                                    >
                                        <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                                    </Button>
                                </>
                            )}
                        </div>
                    </header>

                    {!isAuthenticated ? (
                        <div className="flex flex-col items-center justify-center pt-20 max-w-md mx-auto">
                            <Card className="w-full border-primary/20 shadow-2xl overflow-hidden">
                                <div className="bg-primary h-1.5 w-full" />
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2 text-2xl">
                                        <Lock className="w-6 h-6 text-primary" /> Admin Login
                                    </CardTitle>
                                    <CardDescription>Authentication required to access station controls</CardDescription>
                                </CardHeader>
                                <form onSubmit={handleLogin}>
                                    <CardContent className="space-y-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="password">Security Password</Label>
                                            <Input
                                                id="password"
                                                type="password"
                                                value={password}
                                                onChange={(e) => setPassword(e.target.value)}
                                                placeholder="••••••••••••"
                                                autoFocus
                                                className="h-12 text-lg"
                                            />
                                        </div>
                                    </CardContent>
                                    <CardFooter>
                                        <Button type="submit" className="w-full gap-2 h-12 text-lg">
                                            <LogIn className="w-5 h-5" /> Access Dashboard
                                        </Button>
                                    </CardFooter>
                                </form>
                            </Card>
                        </div>
                    ) : (
                        <Tabs defaultValue="scroll" className="w-full space-y-6">
                            <TabsList className="w-full max-w-md mx-auto h-12 p-1 bg-secondary/50 backdrop-blur-sm border border-border/50">
                                <TabsTrigger value="scroll" className="flex-1 gap-2 data-[state=active]:bg-background">
                                    <Zap className="w-4 h-4" /> Live
                                </TabsTrigger>
                                <TabsTrigger value="news" className="flex-1 gap-2 data-[state=active]:bg-background">
                                    <Newspaper className="w-4 h-4" /> Archive
                                </TabsTrigger>
                                <TabsTrigger value="social" className="flex-1 gap-2 data-[state=active]:bg-background" onClick={() => navigate("/social")}>
                                    <Share2 className="w-4 h-4" /> Socials
                                </TabsTrigger>
                            </TabsList>



                            <TabsContent value="scroll" className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                                <div className="lg:col-span-12">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        {/* Main Controls Card */}
                                        <Card className="shadow-lg border-border/50 overflow-hidden">
                                            <CardHeader className="bg-secondary/20 border-b border-border/30">
                                                <CardTitle className="text-lg flex items-center gap-2">
                                                    <Settings className="w-5 h-5 text-primary" /> Display Settings
                                                </CardTitle>
                                                <CardDescription>Configure what appears on the player's scrolling ticker</CardDescription>
                                            </CardHeader>
                                            <CardContent className="space-y-6 pt-6">
                                                <div className="space-y-3">
                                                    <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                                                        Ticker Type
                                                    </Label>
                                                    <SegmentedSwitch
                                                        options={[
                                                            { label: "Station Info", value: "information" },
                                                            { label: "Live News Feed", value: "news" }
                                                        ]}
                                                        activeValue={scrollType}
                                                        onChange={(val) => setScrollType(val as any)}
                                                    />
                                                </div>

                                                <div className="flex items-center justify-between p-4 bg-secondary/30 rounded-lg border border-border/50">
                                                    <div className="space-y-1">
                                                        <Label htmlFor="override-toggle" className="text-sm font-bold">
                                                            Manual Override
                                                        </Label>
                                                        <p className="text-xs text-muted-foreground">
                                                            Force display the message below
                                                        </p>
                                                    </div>
                                                    <Switch
                                                        id="override-toggle"
                                                        checked={overrideEnabled}
                                                        onCheckedChange={setOverrideEnabled}
                                                    />
                                                </div>

                                                <div className="space-y-2">
                                                    <Label htmlFor="message" className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                                                        Display Message
                                                    </Label>
                                                    <Textarea
                                                        id="message"
                                                        placeholder="e.g. Welcome to Freedom Naija Radio!"
                                                        value={overrideMessage}
                                                        onChange={(e) => setOverrideMessage(e.target.value)}
                                                        className="min-h-[120px] resize-none text-base border-border/50 focus:border-primary/50"
                                                        maxLength={2000}
                                                    />
                                                    <div className="flex justify-between items-center text-[10px]">
                                                        <p className="text-muted-foreground">Markdown supported for links</p>
                                                        <p className={`${overrideMessage.length > 1800 ? 'text-destructive font-bold' : 'text-muted-foreground'}`}>
                                                            {overrideMessage.length}/2000
                                                        </p>
                                                    </div>
                                                </div>
                                            </CardContent>
                                            <CardFooter className="bg-secondary/10 border-t border-border/30">
                                                <Button
                                                    className="w-full gap-2 h-12 text-base font-bold shadow-lg shadow-primary/20"
                                                    onClick={handleSave}
                                                    disabled={isSaving}
                                                >
                                                    {isSaving ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                                                    Apply Changes
                                                </Button>
                                            </CardFooter>
                                        </Card>

                                        {/* Aggregator Status Card */}
                                        <Card className="shadow-lg border-border/50 flex flex-col">
                                            <CardHeader className="bg-secondary/20 border-b border-border/30">
                                                <div className="flex items-center justify-between">
                                                    <CardTitle className="text-lg flex items-center gap-2">
                                                        <Radio className="w-5 h-5 text-primary" /> Aggregator Engine
                                                    </CardTitle>
                                                    <Badge className={`${aggStatus?.lastError ? 'bg-destructive' : 'bg-emerald-500'} text-white`}>
                                                        {aggStatus?.lastError ? 'FAILED' : 'ONLINE'}
                                                    </Badge>
                                                </div>
                                                <CardDescription>Real-time status of news fetching sources</CardDescription>
                                            </CardHeader>
                                            <CardContent className="space-y-6 pt-6 flex-grow">
                                                {/* Source status indicators */}
                                                <div className="grid grid-cols-1 gap-3">
                                                    {['newsapi', 'newsdata', 'gnews'].map((source) => {
                                                        const sourceData = aggStatus?.providerRotation?.find(p => p.name.toLowerCase() === source.toLowerCase());
                                                        const label = PROVIDER_LABELS[source];
                                                        return (
                                                            <div key={source} className={`p-4 rounded-xl border flex items-center justify-between transition-all ${sourceData?.isCurrent ? 'bg-primary/10 border-primary/30 shadow-inner' : 'bg-secondary/20 border-border/30'}`}>
                                                                <div className="flex items-center gap-3">
                                                                    <div className={`p-2 rounded-full ${sourceData?.isCurrent ? 'bg-primary text-white animate-pulse' : 'bg-muted text-muted-foreground'}`}>
                                                                        <Globe className="w-4 h-4" />
                                                                    </div>
                                                                    <div>
                                                                        <p className="text-sm font-bold leading-tight">{label?.label}</p>
                                                                        <p className="text-[10px] text-muted-foreground uppercase">{sourceData?.isNext ? 'Next up' : sourceData?.isCurrent ? 'Currently fetching' : 'Idle'}</p>
                                                                    </div>
                                                                </div>
                                                                {sourceData?.lastError ? (
                                                                    <div className="flex items-center gap-1 text-destructive">
                                                                        <AlertTriangle className="w-4 h-4" />
                                                                        <span className="text-[10px] font-bold">Error</span>
                                                                    </div>
                                                                ) : (
                                                                    <CheckCircle2 className={`w-5 h-5 ${sourceData?.isCurrent ? 'text-primary' : 'text-emerald-500/50'}`} />
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>

                                                <div className="grid grid-cols-3 gap-2">
                                                    {Object.entries(headlinesData?.stats || {}).filter(([k]) => k !== 'total').map(([key, value]) => (
                                                        <div key={key} className="bg-secondary/20 p-3 rounded-xl border border-border/50 text-center">
                                                            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">{key}</p>
                                                            <p className="text-xl font-bold">{value as number}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                            </CardContent>
                                            <CardFooter className="bg-secondary/10 border-t border-border/30 gap-3">
                                                <Select value={selectedProvider} onValueChange={setSelectedProvider}>
                                                    <SelectTrigger className="w-full h-11 bg-background">
                                                        <SelectValue placeholder="Automatic Rotation" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="auto">🔄 Automatic Rotation</SelectItem>
                                                        <SelectItem value="newsapi">🍊 NewsAPI</SelectItem>
                                                        <SelectItem value="newsdata">🔹 NewsData</SelectItem>
                                                        <SelectItem value="gnews">🌿 GNews</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                                <Button 
                                                    variant="secondary" 
                                                    className="h-11 px-4 gap-2 font-bold" 
                                                    onClick={handleManualFetch} 
                                                    disabled={isFetchingHeadlines}
                                                >
                                                    {isFetchingHeadlines ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                                                    Fetch
                                                </Button>
                                            </CardFooter>
                                        </Card>
                                    </div>

                                    {/* Headline Management */}
                                    <div className="mt-8 space-y-4">
                                        <div className="flex items-center justify-between px-2">
                                            <h3 className="text-xl font-bold flex items-center gap-2">
                                                <Newspaper className="w-6 h-6 text-primary" />
                                                Live Ticker Feed
                                                <Badge variant="secondary" className="ml-2 bg-primary/10 text-primary border-none">
                                                    {headlinesData?.fullHeadlines?.length || 0} items
                                                </Badge>
                                            </h3>
                                            <div className="text-[11px] text-muted-foreground flex items-center gap-1 bg-secondary/30 px-3 py-1 rounded-full border border-border/50">
                                                <Clock className="w-3 h-3" />
                                                Sync: {headlinesData?.lastUpdated ? new Date(headlinesData.lastUpdated).toLocaleTimeString() : 'Never'}
                                            </div>
                                        </div>

                                        {!headlinesData?.fullHeadlines?.length ? (
                                            <div className="text-center py-20 bg-card rounded-2xl border-2 border-dashed border-border flex flex-col items-center justify-center gap-4">
                                                <div className="p-4 bg-muted rounded-full">
                                                    <Newspaper className="w-12 h-12 text-muted-foreground/30" />
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="font-bold text-lg">No active headlines</p>
                                                    <p className="text-sm text-muted-foreground">Trigger a manual fetch to populate the live feed</p>
                                                </div>
                                                <Button variant="outline" onClick={handleManualFetch}>Fetch Now</Button>
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 max-h-[800px] overflow-y-auto pr-2 custom-scrollbar">
                                                {headlinesData.fullHeadlines.map((h: HeadlineItem, i: number) => (
                                                    <Card key={h.id || i} className="group hover:border-primary/50 transition-all duration-200 border-border/50 overflow-hidden bg-card/50 backdrop-blur-sm">
                                                        <div className="p-4 flex gap-4">
                                                            <div className="flex-1 min-w-0 space-y-2">
                                                                <div className="flex items-center gap-2">
                                                                    <Badge variant={REGION_BADGES[h.region]?.variant || 'outline'} className="text-[9px] h-4 px-1.5 font-bold uppercase tracking-tighter">
                                                                        {REGION_BADGES[h.region]?.label || h.region}
                                                                    </Badge>
                                                                    <span className="text-[10px] font-bold text-primary tracking-widest uppercase truncate max-w-[100px] opacity-70 group-hover:opacity-100">{h.source}</span>
                                                                </div>
                                                                <p className="text-sm font-bold leading-tight line-clamp-2 underline-offset-4 decoration-primary/20 hover:underline cursor-help" title={h.title}>
                                                                    {h.title}
                                                                </p>
                                                                <p className="text-[10px] text-muted-foreground line-clamp-1 italic">{h.summary || 'No summary provided'}</p>
                                                            </div>
                                                            <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity translate-x-2 group-hover:translate-x-0">
                                                                <Button variant="secondary" size="icon" className="h-8 w-8 hover:bg-primary hover:text-white" onClick={() => openEditHeadline(h)}>
                                                                    <Pencil className="w-3.5 h-3.5" />
                                                                </Button>
                                                                <Button variant="secondary" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive hover:text-white" onClick={() => handleDeleteHeadline(h.id)}>
                                                                    <Trash2 className="w-3.5 h-3.5" />
                                                                </Button>
                                                                <Button variant="secondary" size="icon" className="h-8 w-8" asChild>
                                                                    <a href={h.url} target="_blank" rel="noopener noreferrer">
                                                                        <ExternalLink className="w-3.5 h-3.5" />
                                                                    </a>
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    </Card>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </TabsContent>

                            <TabsContent value="news" className="space-y-6">
                                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-secondary/20 p-6 rounded-2xl border border-border/50">
                                    <div className="space-y-1">
                                        <h2 className="text-2xl font-bold flex items-center gap-2">
                                            <Archive className="w-6 h-6 text-primary" />
                                            Manual News Items
                                        </h2>
                                        <p className="text-sm text-muted-foreground">Manage static news articles and announcements</p>
                                    </div>
                                    <Button size="lg" className="shadow-lg shadow-primary/20 gap-2 h-12 w-full sm:w-auto" onClick={() => { setEditingNews(null); setNewsForm({ title: "", content: "", status: "Published", pinned: false }); setIsNewsDialogOpen(true); }}>
                                        <Plus className="w-5 h-5" /> Create Article
                                    </Button>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-12">
                                    {news.length === 0 ? (
                                        <div className="col-span-full text-center py-24 text-muted-foreground bg-card rounded-2xl border border-dashed border-border flex flex-col items-center gap-3">
                                            <Newspaper className="w-12 h-12 text-muted-foreground/20" />
                                            <p>No manual news items currently exist.</p>
                                        </div>
                                    ) : (
                                        news.map((item: any) => (
                                            <Card key={item.id} className={`group hover:scale-[1.02] transition-all duration-200 border-border/50 ${item.pinned ? 'bg-primary/5 border-primary/20' : ''}`}>
                                                <CardHeader className="pb-4 p-5 space-y-4">
                                                    <div className="flex justify-between items-start">
                                                        <div className="flex flex-col gap-2">
                                                            <div className="flex items-center gap-2">
                                                                {item.pinned && <Badge className="h-5 gap-1 bg-primary px-1.5"><Pin className="w-3 h-3 fill-white" /> PINNED</Badge>}
                                                                <Badge variant={item.status === 'Published' ? 'default' : 'secondary'} className="text-[9px] h-5 tracking-widest font-bold">
                                                                    {item.status.toUpperCase()}
                                                                </Badge>
                                                            </div>
                                                            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                                                <Clock className="w-3 h-3" /> {new Date(item.created_at || Date.now()).toLocaleDateString()}
                                                            </div>
                                                        </div>
                                                        <div className="flex gap-1">
                                                            <Button variant="secondary" size="icon" className="h-8 w-8 hover:bg-primary hover:text-white" onClick={() => openEditNews(item)}>
                                                                <Pencil className="w-3.5 h-3.5" />
                                                            </Button>
                                                            <Button variant="secondary" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive hover:text-white" onClick={() => handleDeleteNews(item.id)}>
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                            </Button>
                                                        </div>
                                                    </div>
                                                    <CardTitle className="text-base font-bold leading-snug line-clamp-2 h-12">
                                                        {item.title}
                                                    </CardTitle>
                                                    <CardDescription className="text-xs line-clamp-3 min-h-[48px]">
                                                        {item.content || 'No content provided'}
                                                    </CardDescription>
                                                </CardHeader>
                                                <CardFooter className="pt-0 p-5 px-5">
                                                    <Button variant="ghost" size="sm" className="w-full h-8 text-xs font-bold gap-2 hover:bg-primary/10 hover:text-primary" onClick={() => openEditNews(item)}>
                                                        Quick Edit Details <ArrowLeft className="w-3 h-3 rotate-180" />
                                                    </Button>
                                                </CardFooter>
                                            </Card>
                                        ))
                                    )}
                                </div>
                            </TabsContent>
                        </Tabs>
                    )}
                </div>
            </div>

            {/* Dialogs */}
            <Dialog open={isNewsDialogOpen} onOpenChange={setIsNewsDialogOpen}>
                <DialogContent className="sm:max-w-xl p-0 overflow-hidden rounded-2xl border-none">
                    <div className="bg-primary h-1.5 w-full" />
                    <div className="p-6 space-y-6">
                        <DialogHeader>
                            <DialogTitle className="text-2xl font-bold flex items-center gap-2">
                                {editingNews ? <Pencil className="w-6 h-6" /> : <Plus className="w-6 h-6" />}
                                {editingNews ? 'Edit News Article' : 'Compose News Article'}
                            </DialogTitle>
                            <DialogDescription>
                                Create or update a news post for the app's manual news section.
                            </DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleSaveNews} className="space-y-6 py-2">
                            <div className="space-y-2">
                                <Label htmlFor="news-title" className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Title</Label>
                                <Input id="news-title" value={newsForm.title} onChange={e => setNewsForm({ ...newsForm, title: e.target.value })} required className="h-12 text-lg border-border/50" placeholder="Breaking: Station upgrade completed..." />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="news-content" className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Article Body</Label>
                                <Textarea id="news-content" value={newsForm.content} onChange={e => setNewsForm({ ...newsForm, content: e.target.value })} required className="min-h-[250px] text-base border-border/50 p-4" placeholder="Enter article content here..." />
                            </div>
                            <div className="flex flex-col sm:flex-row items-center gap-6 p-4 bg-secondary/30 rounded-xl border border-border/50">
                                <div className="w-full sm:flex-1 space-y-2">
                                    <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Publishing Status</Label>
                                    <Select value={newsForm.status} onValueChange={val => setNewsForm({ ...newsForm, status: val })}>
                                        <SelectTrigger className="w-full h-11 bg-background border-border/30">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Published">🚀 Published</SelectItem>
                                            <SelectItem value="Draft">📝 Draft</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="flex items-center justify-between w-full sm:w-auto gap-4 pt-4 sm:pt-0">
                                    <Label htmlFor="pinned" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Sticky Track</Label>
                                    <div className="flex items-center gap-2 bg-background px-4 py-2 rounded-lg border border-border/30">
                                        <Checkbox id="pinned" checked={newsForm.pinned} onCheckedChange={val => setNewsForm({ ...newsForm, pinned: !!val })} className="h-5 w-5 border-primary/50 data-[state=checked]:bg-primary" />
                                        <Label htmlFor="pinned" className="text-sm font-bold cursor-pointer">Pin to Top</Label>
                                    </div>
                                </div>
                            </div>
                            <DialogFooter className="gap-2 sm:gap-0 pt-2">
                                <Button type="button" variant="ghost" onClick={() => setIsNewsDialogOpen(false)} className="h-12 flex-1">Discard</Button>
                                <Button type="submit" disabled={isLoading} className="h-12 flex-1 text-lg font-bold gap-2">
                                    {isLoading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                                    {editingNews ? 'Update Article' : 'Publish Now'}
                                </Button>
                            </DialogFooter>
                        </form>
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={isHeadlineDialogOpen} onOpenChange={setIsHeadlineDialogOpen}>
                <DialogContent className="sm:max-w-xl p-0 overflow-hidden rounded-2xl border-none">
                    <div className="bg-primary h-1.5 w-full" />
                    <div className="p-6 space-y-6">
                        <DialogHeader>
                            <DialogTitle className="text-2xl font-bold flex items-center gap-2">
                                <Pencil className="w-6 h-6 text-primary" /> Edit Live Headline
                            </DialogTitle>
                            <DialogDescription>
                                Override the automated ticker content for this specific item.
                            </DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleSaveHeadline} className="space-y-6 py-2">
                            <div className="space-y-2">
                                <Label htmlFor="headline-title" className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Headline Title</Label>
                                <Input id="headline-title" value={headlineForm.title} onChange={(e) => setHeadlineForm({ ...headlineForm, title: e.target.value })} required className="h-12 text-lg border-border/50" />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="headline-source" className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Attribution</Label>
                                    <Input id="headline-source" value={headlineForm.source} onChange={(e) => setHeadlineForm({ ...headlineForm, source: e.target.value })} className="h-11 bg-secondary/30 border-border/30" />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-sm font-bold uppercase tracking-widest text-muted-foreground">ID Reference</Label>
                                    <div className="h-11 px-3 flex items-center bg-secondary/10 border border-border/20 rounded-md text-[10px] font-mono text-muted-foreground">
                                        {editingHeadline?.id || 'NO_ID'}
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="headline-summary" className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Brief Summary</Label>
                                <Textarea id="headline-summary" value={headlineForm.summary} onChange={(e) => setHeadlineForm({ ...headlineForm, summary: e.target.value })} className="min-h-[120px] border-border/50 text-base" />
                            </div>
                            <DialogFooter className="gap-2 sm:gap-0 pt-2">
                                <Button type="button" variant="ghost" onClick={closeEditHeadline} className="h-12 flex-1">Cancel</Button>
                                <Button type="submit" disabled={isSavingHeadline} className="h-12 flex-1 text-lg font-bold gap-2">
                                    {isSavingHeadline ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                                    Update Feed
                                </Button>
                            </DialogFooter>
                        </form>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default Admin;