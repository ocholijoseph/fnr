import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowLeft, Save, RefreshCw, Settings, Lock, LogIn, Newspaper, Plus, Trash2, Pencil, Pin, Globe, Clock, Zap, Radio, AlertTriangle, CheckCircle2, XCircle, Share2, ExternalLink } from "lucide-react";
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
    const [selectedProvider, setSelectedProvider] = useState<string>('');
    const [isHeadlineDialogOpen, setIsHeadlineDialogOpen] = useState(false);
    const [editingHeadline, setEditingHeadline] = useState<HeadlineItem | null>(null);
    const [headlineForm, setHeadlineForm] = useState({ title: '', summary: '', source: '' });
    const [isSavingHeadline, setIsSavingHeadline] = useState(false);

    const navigate = useNavigate();

    const getAuthHeader = () => ({
        'Authorization': `Bearer ${sessionStorage.getItem("admin_password") || ""}`
    });

    const fetchConfig = async () => {
        if (!isAuthenticated) return;
        setIsLoading(true);
        try {
            const response = await fetch('/api/scroll', {
                headers: getAuthHeader()
            });
            if (response.ok) {
                const data = await response.json();
                setOverrideEnabled(data.overrideEnabled);
                setOverrideMessage(data.overrideMessage || "");
                setScrollType(data.scrollType || "information");
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
    };

    const fetchSubmissions = async () => {
        if (!isAuthenticated) return;
        try {
            const [newsRes] = await Promise.all([
                fetch('/api/news', { headers: getAuthHeader() })
            ]);
            if (newsRes.status === 401) {
                setIsAuthenticated(false);
                return;
            }
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

    const handleFetchLatestNews = async () => {
        setIsFetchingNews(true);
        try {
            const response = await fetch('/api/news/fetch', {
                method: 'POST',
                headers: getAuthHeader()
            });
            if (response.ok) {
                toast.success("Latest news fetched successfully");
                fetchSubmissions();
            } else {
                const errData = await response.json().catch(() => ({}));
                toast.error(errData.error || "Failed to fetch news");
            }
        } catch (error) {
            toast.error("Error connecting to news service");
        } finally {
            setIsFetchingNews(false);
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
    }, [isAuthenticated, loadHeadlines, loadAggStatus]);

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
        setHeadlinesData(prev => prev ? ({
            ...prev,
            fullHeadlines: prev.fullHeadlines.filter(h => h.id !== id)
        }) : prev);
        try {
            await deleteHeadline(id);
            toast.success('Headline deleted');
            await loadHeadlines();
            await loadAggStatus();
        } catch (error: any) {
            console.error('Error deleting headline:', error);
            toast.error(error?.message || 'Failed to delete headline');
            await loadHeadlines();
            await loadAggStatus();
        }
    };

    return (
        <div className="h-full w-full max-w-[362px] mx-auto flex flex-col">
            <div className="h-full w-full overflow-y-auto overflow-x-hidden flex-grow">
                <div className="h-full w-full py-4 px-4 space-y-6 flex flex-col">
                    <header className="flex items-center justify-between">
                        <Button variant="ghost" onClick={() => navigate("/")} className="gap-2 text-xs sm:text-sm">
                            <ArrowLeft className="w-4 h-4" /> Back to Player
                        </Button>
                        <h1 className="text-2xl font-bold">Admin</h1>
                        <div className="flex gap-2">
                            {isAuthenticated && (
                                <Button variant="outline" size="sm" onClick={handleLogout} className="text-xs">
                                    Logout
                                </Button>
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
                                            <Input
                                                id="password"
                                                type="password"
                                                value={password}
                                                onChange={(e) => setPassword(e.target.value)}
                                                placeholder="Enter admin password"
                                                autoFocus
                                            />
                                        </div>
                                    </CardContent>
                                    <CardFooter>
                                        <Button type="submit" className="w-full gap-2">
                                            <LogIn className="w-4 h-4" /> Login
                                        </Button>
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
                                <TabsTrigger value="news" className="gap-1 text-xs sm:text-sm">
                                    <Newspaper className="w-3 h-3" /> News
                                </TabsTrigger>
                                <TabsTrigger value="social" className="gap-1 text-xs sm:text-sm" onClick={() => navigate("/social")}>
                                    <Share2 className="w-3 h-3" /> Social
                                </TabsTrigger>
                            </TabsList>

                            <TabsContent value="scroll" className="space-y-6">
                                <main className="space-y-6 bg-card p-4 rounded-xl border border-border shadow-sm">
                                    <div className="space-y-4">
                                        <div className="space-y-2 pb-4 border-b border-border">
                                            <Label className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                                                Scroll Content Type
                                            </Label>
                                            <SegmentedSwitch
                                                options={[
                                                    { label: "Information", value: "information" },
                                                    { label: "News", value: "news" }
                                                ]}
                                                activeValue={scrollType}
                                                onChange={(val) => setScrollType(val as any)}
                                            />
                                        </div>

                                        <div className="flex items-center justify-between pb-4 border-b border-border">
                                            <div className="space-y-0.5">
                                                <Label htmlFor="override-toggle" className="text-base font-semibold">
                                                    Enable Information Scroll Override
                                                </Label>
                                                <p className="text-sm text-muted-foreground">
                                                    This replaces the live Artist/Song metadata.
                                                </p>
                                            </div>
                                            <Switch
                                                id="override-toggle"
                                                checked={overrideEnabled}
                                                onCheckedChange={setOverrideEnabled}
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="message" className="text-sm font-medium">
                                                Override Message
                                            </Label>
                                            <Textarea
                                                id="message"
                                                placeholder="e.g. Welcome to Freedom Naija Radio!"
                                                value={overrideMessage}
                                                onChange={(e) => setOverrideMessage(e.target.value)}
                                                className="min-h-[100px] resize-none"
                                                maxLength={2000}
                                            />
                                            <div className="text-right text-[10px] text-muted-foreground">
                                                {overrideMessage.length}/2000
                                            </div>
                                        </div>
                                    </div>

                                    <Button
                                        className="w-full gap-2 h-12 text-base font-bold"
                                        onClick={handleSave}
                                        disabled={isSaving}
                                    >
                                        {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                        Save & Update Scroll
                                    </Button>
                                </main>

                                {/* Aggregator Section */}
                                <Card className="border-primary/20 bg-primary/5">
                                    <CardHeader className="pb-2">
                                        <div className="flex items-center justify-between">
                                            <CardTitle className="text-sm font-bold flex items-center gap-2">
                                                <Zap className="w-4 h-4 text-primary" /> News Aggregator
                                            </CardTitle>
                                            <Badge variant={aggStatus?.lastError ? 'destructive' : 'default'} className="text-[9px] h-4">
                                                {aggStatus?.lastError ? 'Error' : 'Operational'}
                                            </Badge>
                                        </div>
                                        <CardDescription className="text-[10px]">Auto-fetches latest news for the ticker.</CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="grid grid-cols-3 gap-2">
                                            <div className="bg-background/50 p-2 rounded-lg border border-border/50 text-center">
                                                <p className="text-[10px] text-muted-foreground uppercase font-semibold">Nigeria</p>
                                                <p className="text-lg font-bold">{headlinesData?.stats?.nigeria || 0}</p>
                                            </div>
                                            <div className="bg-background/50 p-2 rounded-lg border border-border/50 text-center">
                                                <p className="text-[10px] text-muted-foreground uppercase font-semibold">Africa</p>
                                                <p className="text-lg font-bold">{headlinesData?.stats?.africa || 0}</p>
                                            </div>
                                            <div className="bg-background/50 p-2 rounded-lg border border-border/50 text-center">
                                                <p className="text-[10px] text-muted-foreground uppercase font-semibold">World</p>
                                                <p className="text-lg font-bold">{headlinesData?.stats?.world || 0}</p>
                                            </div>
                                        </div>
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
                                        <Button size="sm" className="flex-1 gap-2 h-8" onClick={handleManualFetch} disabled={isFetchingHeadlines}>
                                            {isFetchingHeadlines ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                                            Fetch Now
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
                                            No headlines yet.
                                        </div>
                                    ) : (
                                        headlinesData.fullHeadlines.slice(0, 10).map((h: HeadlineItem, i: number) => (
                                            <Card key={h.id || i} className="border-l-2 border-l-primary/30">
                                                <CardContent className="p-3">
                                                    <div className="flex items-start justify-between gap-2">
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-xs font-medium leading-tight line-clamp-2">{h.title}</p>
                                                            <div className="flex items-center gap-2 mt-2">
                                                                <Badge variant={REGION_BADGES[h.region]?.variant || 'outline'} className="text-[8px] h-3 px-1">
                                                                    {REGION_BADGES[h.region]?.label || h.region}
                                                                </Badge>
                                                                <span className="text-[9px] text-muted-foreground">{h.source}</span>
                                                            </div>
                                                        </div>
                                                        <div className="flex gap-1">
                                                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openEditHeadline(h)}>
                                                                <Pencil className="w-3 h-3" />
                                                            </Button>
                                                            <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => handleDeleteHeadline(h.id)}>
                                                                <Trash2 className="w-3 h-3" />
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        ))
                                    )}
                                </div>
                            </TabsContent>

                            <TabsContent value="news" className="space-y-4 text-left">
                                <div className="flex justify-between items-center bg-card p-4 rounded-xl border border-border shadow-sm">
                                    <h2 className="text-lg font-bold flex items-center gap-2">
                                        <Newspaper className="w-5 h-5 text-primary" />
                                        News Items
                                    </h2>
                                    <Button size="sm" className="gap-2" onClick={() => { setEditingNews(null); setNewsForm({ title: "", content: "", status: "Published", pinned: false }); setIsNewsDialogOpen(true); }}>
                                        <Plus className="w-4 h-4" /> Add
                                    </Button>
                                </div>

                                <div className="space-y-3 pb-8">
                                    {news.length === 0 ? (
                                        <div className="text-center py-12 text-muted-foreground bg-card rounded-xl border border-dashed border-border">
                                            No manual news items.
                                        </div>
                                    ) : (
                                        news.map((item: any) => (
                                            <Card key={item.id} className={`${item.pinned ? 'border-primary/50 bg-primary/5' : ''}`}>
                                                <CardHeader className="pb-2 p-4">
                                                    <div className="flex justify-between items-center">
                                                        <div className="flex items-center gap-2">
                                                            {item.pinned && <Pin className="w-3 h-3 text-primary fill-primary" />}
                                                            <Badge variant={item.status === 'Published' ? 'default' : 'secondary'} className="text-[8px]">
                                                                {item.status.toUpperCase()}
                                                            </Badge>
                                                        </div>
                                                        <div className="flex gap-1">
                                                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditNews(item)}>
                                                                <Pencil className="w-3 h-3" />
                                                            </Button>
                                                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDeleteNews(item.id)}>
                                                                <Trash2 className="w-3 h-3" />
                                                            </Button>
                                                        </div>
                                                    </div>
                                                    <CardTitle className="text-sm line-clamp-1 mt-1">{item.title}</CardTitle>
                                                </CardHeader>
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
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>{editingNews ? 'Edit News' : 'Add News'}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSaveNews} className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="news-title">Title</Label>
                            <Input id="news-title" value={newsForm.title} onChange={e => setNewsForm({ ...newsForm, title: e.target.value })} required />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="news-content">Content</Label>
                            <Textarea id="news-content" value={newsForm.content} onChange={e => setNewsForm({ ...newsForm, content: e.target.value })} required />
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="flex-1">
                                <Label>Status</Label>
                                <Select value={newsForm.status} onValueChange={val => setNewsForm({ ...newsForm, status: val })}>
                                    <SelectTrigger className="w-full">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Published">Published</SelectItem>
                                        <SelectItem value="Draft">Draft</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex items-center space-x-2 pt-6">
                                <Checkbox id="pinned" checked={newsForm.pinned} onCheckedChange={val => setNewsForm({ ...newsForm, pinned: !!val })} />
                                <Label htmlFor="pinned">Pin</Label>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button type="submit" disabled={isLoading} className="w-full">Save News</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog open={isHeadlineDialogOpen} onOpenChange={setIsHeadlineDialogOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Edit Headline</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSaveHeadline} className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="headline-title">Title</Label>
                            <Input id="headline-title" value={headlineForm.title} onChange={(e) => setHeadlineForm({ ...headlineForm, title: e.target.value })} required />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="headline-summary">Summary</Label>
                            <Textarea id="headline-summary" value={headlineForm.summary} onChange={(e) => setHeadlineForm({ ...headlineForm, summary: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="headline-source">Source</Label>
                            <Input id="headline-source" value={headlineForm.source} onChange={(e) => setHeadlineForm({ ...headlineForm, source: e.target.value })} />
                        </div>
                        <DialogFooter>
                            <Button type="submit" disabled={isSavingHeadline} className="w-full">Save Headline</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default Admin;