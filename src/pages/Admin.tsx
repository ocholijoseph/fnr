import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowLeft, Save, RefreshCw, MessageCircle, Heart, Settings, Lock, LogIn, Newspaper, Plus, Trash2, Pencil, Pin } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import SegmentedSwitch from "@/components/SegmentedSwitch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

const Admin = () => {
    const [overrideEnabled, setOverrideEnabled] = useState(false);
    const [overrideMessage, setOverrideMessage] = useState("");
    const [scrollType, setScrollType] = useState<"information" | "news">("information");
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [prayerRequests, setPrayerRequests] = useState<any[]>([]);
    const [testimonies, setTestimonies] = useState<any[]>([]);
    const [news, setNews] = useState<any[]>([]);
    const [isAuthenticated, setIsAuthenticated] = useState(!!sessionStorage.getItem("admin_password"));
    const [password, setPassword] = useState("");
    const [isNewsDialogOpen, setIsNewsDialogOpen] = useState(false);
    const [editingNews, setEditingNews] = useState<any>(null);
    const [newsForm, setNewsForm] = useState({ title: "", content: "", status: "Published", pinned: false });
    const [isTestimonyDialogOpen, setIsTestimonyDialogOpen] = useState(false);
    const [editingTestimony, setEditingTestimony] = useState<any>(null);
    const [testimonyForm, setTestimonyForm] = useState({ name: "", email: "", message: "", allow_public: false });
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
            const [prRes, testRes, newsRes] = await Promise.all([
                fetch('/api/prayer-request', { headers: getAuthHeader() }),
                fetch('/api/testimonies', { headers: getAuthHeader() }),
                fetch('/api/news', { headers: getAuthHeader() })
            ]);
            if (prRes.status === 401 || testRes.status === 401 || newsRes.status === 401) {
                setIsAuthenticated(false);
                return;
            }
            if (prRes.ok) setPrayerRequests(await prRes.json());
            if (testRes.ok) setTestimonies(await testRes.json());
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

    const handleSaveTestimony = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            const response = await fetch('/api/testimonies', {
                method: "PUT",
                headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
                body: JSON.stringify({ ...testimonyForm, id: editingTestimony.id })
            });
            if (response.ok) {
                toast.success("Testimony updated successfully");
                setIsTestimonyDialogOpen(false);
                setEditingTestimony(null);
                fetchSubmissions();
            } else {
                const errData = await response.json().catch(() => ({}));
                toast.error(errData.error || "Failed to update testimony");
            }
        } catch (error) {
            toast.error("Error saving testimony");
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteTestimony = async (id: string) => {
        if (!confirm("Are you sure you want to delete this testimony?")) return;
        try {
            const response = await fetch(`/api/testimonies?id=${id}`, {
                method: "DELETE",
                headers: getAuthHeader()
            });
            if (response.ok) {
                toast.success("Testimony deleted");
                fetchSubmissions();
            }
        } catch (error) {
            toast.error("Error deleting testimony");
        }
    };

    const openEditTestimony = (item: any) => {
        setEditingTestimony(item);
        setTestimonyForm({
            name: item.name,
            email: item.email || "",
            message: item.message,
            allow_public: item.allow_public || item.allowPublicShare || false
        });
        setIsTestimonyDialogOpen(true);
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
        }
    }, [isAuthenticated]);

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
            } else if (response.status === 401) {
                const errorData = await response.json().catch(() => ({}));
                let diagMsg = "";
                if (errorData.diagnostic) {
                    const { providedLength, expectedLength, hasEnv } = errorData.diagnostic;
                    diagMsg = ` (Sent: ${providedLength}, Expected: ${expectedLength}, EnvSet: ${hasEnv})`;
                }
                toast.error(`Unauthorized${diagMsg}. Please check your password.`);
                setIsAuthenticated(false);
            } else {
                const errorData = await response.json().catch(() => ({}));
                toast.error(errorData.error || `Failed to save settings (${response.status})`);
            }
        } catch (error) {
            console.error("Error saving config:", error);
            toast.error("Connecting failed. Is the API server running?");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="h-full w-full max-w-[412px] mx-auto flex flex-col">
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
                            <Button variant="outline" size="icon" onClick={() => { fetchConfig(); fetchSubmissions(); }} disabled={isLoading || !isAuthenticated}>
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
                            <TabsList className="grid w-full grid-cols-4 mb-8">
                                <TabsTrigger value="scroll" className="gap-2 text-xs sm:text-sm">
                                    <Settings className="w-4 h-4" /> Scroll
                                </TabsTrigger>
                                <TabsTrigger value="prayers" className="gap-2 text-xs sm:text-sm">
                                    <Heart className="w-4 h-4" /> Prayers
                                    {prayerRequests.length > 0 && (
                                        <Badge variant="secondary" className="ml-1 px-1.5 py-0 min-w-[1.2rem] h-5 justify-center">
                                            {prayerRequests.length}
                                        </Badge>
                                    )}
                                </TabsTrigger>
                                <TabsTrigger value="testimonies" className="gap-2 text-xs sm:text-sm">
                                    <MessageCircle className="w-4 h-4" /> Testimonies
                                    {testimonies.length > 0 && (
                                        <Badge variant="secondary" className="ml-1 px-1.5 py-0 min-w-[1.2rem] h-5 justify-center">
                                            {testimonies.length}
                                        </Badge>
                                    )}
                                </TabsTrigger>
                                <TabsTrigger value="news" className="gap-2 text-xs sm:text-sm">
                                    <Newspaper className="w-4 h-4" /> News
                                    {news.length > 0 && (
                                        <Badge variant="secondary" className="ml-1 px-1.5 py-0 min-w-[1.2rem] h-5 justify-center">
                                            {news.length}
                                        </Badge>
                                    )}
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
                                                    When enabled, this message replaces the live Artist/Song metadata.
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
                                                placeholder="e.g. Welcome to Kingdom FM! Sunday Service starts 9AM."
                                                value={overrideMessage}
                                                onChange={(e) => setOverrideMessage(e.target.value)}
                                                className="min-h-[120px] resize-none"
                                                maxLength={2000}
                                            />
                                            <div className="text-right text-xs text-muted-foreground">
                                                {overrideMessage.length}/2000 characters
                                            </div>
                                        </div>
                                    </div>

                                    <Button
                                        className="w-full gap-2 h-12 text-base font-bold"
                                        onClick={handleSave}
                                        disabled={isSaving}
                                    >
                                        {isSaving ? (
                                            <>
                                                <RefreshCw className="w-4 h-4 animate-spin" /> Saving...
                                            </>
                                        ) : (
                                            <>
                                                <Save className="w-4 h-4" /> Save & Update Scroll
                                            </>
                                        )}
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

                            <TabsContent value="prayers" className="space-y-4">
                                {prayerRequests.length === 0 ? (
                                    <div className="text-center py-12 text-muted-foreground bg-card rounded-xl border border-dashed border-border">
                                        No prayer requests received yet.
                                    </div>
                                ) : (
                                    prayerRequests.map((pr) => (
                                        <Card key={pr.id}>
                                            <CardHeader className="pb-2">
                                                <div className="flex justify-between items-start text-xs text-muted-foreground mb-1">
                                                    <span>{new Date(pr.createdAt).toLocaleString()}</span>
                                                    <span className="font-mono text-[10px]">{pr.email}</span>
                                                </div>
                                                <CardTitle className="text-lg">{pr.name}</CardTitle>
                                            </CardHeader>
                                            <CardContent>
                                                <p className="text-sm whitespace-pre-wrap">{pr.message}</p>
                                            </CardContent>
                                        </Card>
                                    )).reverse()
                                )}
                            </TabsContent>

                            <TabsContent value="testimonies" className="space-y-4">
                                {testimonies.length === 0 ? (
                                    <div className="text-center py-12 text-muted-foreground bg-card rounded-xl border border-dashed border-border">
                                        No testimonies shared yet.
                                    </div>
                                ) : (
                                    testimonies.map((test) => (
                                        <Card key={test.id}>
                                            <CardHeader className="pb-2">
                                                <div className="flex justify-between items-start text-xs text-muted-foreground mb-1">
                                                    <span>{new Date(test.createdAt).toLocaleString()}</span>
                                                    <div className="flex gap-2">
                                                        {(test.allow_public || test.allowPublicShare) && <Badge variant="outline" className="text-[10px] text-emerald-500 border-emerald-500/50">SHARE PUBLIC</Badge>}
                                                        <span className="font-mono text-[10px]">{test.email || "No Email"}</span>
                                                    </div>
                                                </div>
                                                <div className="flex justify-between items-center">
                                                    <CardTitle className="text-lg">{test.name}</CardTitle>
                                                    <div className="flex items-center gap-1">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 text-muted-foreground hover:text-primary"
                                                            onClick={() => openEditTestimony(test)}
                                                        >
                                                            <Pencil className="w-4 h-4" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                                            onClick={() => handleDeleteTestimony(test.id)}
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            </CardHeader>
                                            <CardContent>
                                                <p className="text-sm whitespace-pre-wrap">{test.message}</p>
                                            </CardContent>
                                        </Card>
                                    )).reverse()
                                )}
                            </TabsContent>

                            <TabsContent value="news" className="space-y-4 text-left">
                                <div className="flex justify-between items-center bg-card p-4 rounded-xl border border-border shadow-sm">
                                    <h2 className="text-lg font-bold flex items-center gap-2">
                                        <Newspaper className="w-5 h-5 text-primary" />
                                        News Items
                                    </h2>
                                    <Dialog open={isNewsDialogOpen} onOpenChange={setIsNewsDialogOpen}>
                                        <DialogTrigger asChild>
                                            <Button size="sm" className="gap-2" onClick={() => { setEditingNews(null); setNewsForm({ title: "", content: "", status: "Published", pinned: false }); }}>
                                                <Plus className="w-4 h-4" /> Add News
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
                                                    <Textarea id="news-content" value={newsForm.content} onChange={e => setNewsForm({ ...newsForm, content: e.target.value })} placeholder="Details of the announcement..." className="min-h-[150px]" required />
                                                </div>
                                                <div className="flex items-center justify-between gap-4">
                                                    <div className="flex-1 space-y-2">
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
                                            No news items yet. Click "Add News" to start.
                                        </div>
                                    ) : (
                                        news.map((item: any) => (
                                            <Card key={item.id} className={`${item.pinned ? 'border-primary/50 shadow-sm bg-primary/5' : ''}`}>
                                                <CardHeader className="pb-2">
                                                    <div className="flex justify-between items-start">
                                                        <div className="flex items-center gap-2">
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
            {/* Edit Testimony Dialog */}
            <Dialog open={isTestimonyDialogOpen} onOpenChange={setIsTestimonyDialogOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Edit Testimony</DialogTitle>
                        <DialogDescription>Update the details of this testimony.</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSaveTestimony} className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="test-name">Name</Label>
                            <Input
                                id="test-name"
                                value={testimonyForm.name}
                                onChange={(e) => setTestimonyForm({ ...testimonyForm, name: e.target.value })}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="test-email">Email</Label>
                            <Input
                                id="test-email"
                                type="email"
                                value={testimonyForm.email}
                                onChange={(e) => setTestimonyForm({ ...testimonyForm, email: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="test-message">Message</Label>
                            <Textarea
                                id="test-message"
                                value={testimonyForm.message}
                                onChange={(e) => setTestimonyForm({ ...testimonyForm, message: e.target.value })}
                                required
                                className="min-h-[150px]"
                            />
                        </div>
                        <div className="flex items-center space-x-2">
                            <Checkbox
                                id="test-public"
                                checked={testimonyForm.allow_public}
                                onCheckedChange={(checked) => setTestimonyForm({ ...testimonyForm, allow_public: !!checked })}
                            />
                            <Label htmlFor="test-public" className="text-sm font-normal">Allow public sharing</Label>
                        </div>
                        <DialogFooter className="pt-4">
                            <Button type="button" variant="outline" onClick={() => setIsTestimonyDialogOpen(false)}>Cancel</Button>
                            <Button type="submit" disabled={isLoading}>{isLoading ? "Saving..." : "Save Changes"}</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

        </div>
    );
};

export default Admin;