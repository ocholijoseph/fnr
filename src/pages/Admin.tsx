import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowLeft, Save, RefreshCw, MessageCircle, Heart, Settings, Lock, LogIn } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

const Admin = () => {
    const [overrideEnabled, setOverrideEnabled] = useState(false);
    const [overrideMessage, setOverrideMessage] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [prayerRequests, setPrayerRequests] = useState<any[]>([]);
    const [testimonies, setTestimonies] = useState<any[]>([]);
    const [isAuthenticated, setIsAuthenticated] = useState(!!sessionStorage.getItem("admin_password"));
    const [password, setPassword] = useState("");
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
                setOverrideMessage(data.overrideMessage);
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
            const [prRes, testRes] = await Promise.all([
                fetch('/api/prayer-request', { headers: getAuthHeader() }),
                fetch('/api/testimonies', { headers: getAuthHeader() })
            ]);
            if (prRes.status === 401 || testRes.status === 401) {
                setIsAuthenticated(false);
                return;
            }
            if (prRes.ok) setPrayerRequests(await prRes.json());
            if (testRes.ok) setTestimonies(await testRes.json());
        } catch (error) {
            console.error("Error fetching submissions:", error);
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
        }
    }, [isAuthenticated]);

    const handleSave = async () => {
        if (overrideMessage.length > 300) {
            toast.error("Message too long (max 300 characters)");
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
                    overrideMessage: overrideMessage.trim()
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
                        <Button variant="ghost" onClick={() => navigate("/")} className="gap-2">
                            <ArrowLeft className="w-4 h-4" /> Back to Player
                        </Button>
                        <h1 className="text-2xl font-bold">Kingdom FM Xtra Admin</h1>
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
                            <TabsList className="grid w-full grid-cols-3 mb-8">
                                <TabsTrigger value="scroll" className="gap-2">
                                    <Settings className="w-4 h-4" /> Scroll Config
                                </TabsTrigger>
                                <TabsTrigger value="prayers" className="gap-2">
                                    <Heart className="w-4 h-4" /> Prayers
                                    {prayerRequests.length > 0 && (
                                        <Badge variant="secondary" className="ml-1 px-1.5 py-0 min-w-[1.2rem] h-5 justify-center">
                                            {prayerRequests.length}
                                        </Badge>
                                    )}
                                </TabsTrigger>
                                <TabsTrigger value="testimonies" className="gap-2">
                                    <MessageCircle className="w-4 h-4" /> Testimonies
                                    {testimonies.length > 0 && (
                                        <Badge variant="secondary" className="ml-1 px-1.5 py-0 min-w-[1.2rem] h-5 justify-center">
                                            {testimonies.length}
                                        </Badge>
                                    )}
                                </TabsTrigger>
                            </TabsList>

                            <TabsContent value="scroll" className="space-y-6">
                                <main className="space-y-6 bg-card p-4 rounded-xl border border-border shadow-sm">
                                    <div className="space-y-4">
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
                                                maxLength={300}
                                            />
                                            <div className="text-right text-xs text-muted-foreground">
                                                {overrideMessage.length}/300 characters
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
                                                {overrideEnabled ? "OVERRIDE ACTIVE" : "METADATA ACTIVE"}
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
                                                    <span className="font-mono">{pr.email}</span>
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
                                                        <span className="font-mono">{test.email || "No Email"}</span>
                                                    </div>
                                                </div>
                                                <CardTitle className="text-lg">{test.name}</CardTitle>
                                            </CardHeader>
                                            <CardContent>
                                                <p className="text-sm whitespace-pre-wrap">{test.message}</p>
                                            </CardContent>
                                        </Card>
                                    )).reverse()
                                )}
                            </TabsContent>
                        </Tabs>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Admin;