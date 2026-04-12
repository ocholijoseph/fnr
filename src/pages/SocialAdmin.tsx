import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { toast } from "sonner";
import { ArrowLeft, Save, RefreshCw, Plus, Trash2, Globe, Instagram, Facebook, X, MessageCircle, Share2, ToggleLeft, ToggleRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface SocialHandle {
    id: string;
    platform: string;
    url: string;
    enabled: boolean;
}

const PLATFORM_ICONS: Record<string, any> = {
    instagram: Instagram,
    facebook: Facebook,
    twitter: X,
    x: X,
    whatsapp: MessageCircle,
    youtube: Share2,
    other: Globe
};

const SocialAdmin = () => {
    const [socials, setSocials] = useState<SocialHandle[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isAuthenticated, setIsAuthenticated] = useState(!!sessionStorage.getItem("admin_password"));
    const [password, setPassword] = useState("");
    const navigate = useNavigate();

    const getAuthHeader = useCallback(() => ({
        'Authorization': `Bearer ${sessionStorage.getItem("admin_password") || ""}`
    }), []);

    const fetchSocials = useCallback(async () => {
        if (!isAuthenticated) return;
        setIsLoading(true);
        try {
            const response = await fetch('/api/socials', { headers: getAuthHeader() });
            if (response.ok) {
                const data = await response.json();
                setSocials(data);
            } else if (response.status === 401) {
                setIsAuthenticated(false);
                toast.error("Unauthorized. Please login.");
            }
        } catch (error) {
            console.error("Error fetching socials:", error);
            toast.error("Failed to load social handles");
        } finally {
            setIsLoading(false);
        }
    }, [isAuthenticated, getAuthHeader]);

    useEffect(() => {
        if (isAuthenticated) {
            fetchSocials();
        }
    }, [isAuthenticated, fetchSocials]);

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        if (password) {
            sessionStorage.setItem("admin_password", password.trim());
            setIsAuthenticated(true);
        }
    };

    const handleAddSocial = () => {
        const newSocial: SocialHandle = {
            id: Date.now().toString(),
            platform: "other",
            url: "",
            enabled: true
        };
        setSocials([...socials, newSocial]);
    };

    const handleRemoveSocial = (id: string) => {
        setSocials(socials.filter(s => s.id !== id));
    };

    const handleUpdateSocial = (id: string, updates: Partial<SocialHandle>) => {
        setSocials(socials.map(s => s.id === id ? { ...s, ...updates } : s));
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const response = await fetch('/api/socials', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
                body: JSON.stringify(socials)
            });
            if (response.ok) {
                toast.success("Social handles saved successfully!");
            } else {
                toast.error("Failed to save social handles");
            }
        } catch (error) {
            toast.error("Error connecting to server");
        } finally {
            setIsSaving(false);
        }
    };

    if (!isAuthenticated) {
        return (
            <div className="min-h-screen flex items-center justify-center p-4 bg-muted/30">
                <Card className="w-full max-w-md">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">Admin Login</CardTitle>
                        <CardDescription>Enter password to manage social handles</CardDescription>
                    </CardHeader>
                    <form onSubmit={handleLogin}>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="password">Password</Label>
                                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
                            </div>
                        </CardContent>
                        <CardFooter className="flex flex-col gap-2">
                            <Button type="submit" className="w-full">Login</Button>
                            <Button variant="ghost" className="w-full" onClick={() => navigate("/")}>Cancel</Button>
                        </CardFooter>
                    </form>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background p-4 md:p-8">
            <div className="max-w-2xl mx-auto space-y-6">
                <header className="flex items-center justify-between">
                    <Button variant="ghost" onClick={() => navigate("/admin")} className="gap-2">
                        <ArrowLeft className="w-4 h-4" /> Back to Admin
                    </Button>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Share2 className="w-6 h-6 text-primary" /> Social Links
                    </h1>
                    <Button variant="outline" size="icon" onClick={fetchSocials} disabled={isLoading}>
                        <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                    </Button>
                </header>

                <Card>
                    <CardHeader>
                        <CardTitle>Manage Social Media</CardTitle>
                        <CardDescription>Setup the icons and links displayed in the app footer.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {socials.length === 0 && !isLoading && (
                            <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
                                No social handles added yet.
                            </div>
                        )}
                        <div className="space-y-3">
                            {socials.map((social) => (
                                <div key={social.id} className="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-3 rounded-lg border bg-card shadow-sm">
                                    <div className="flex-shrink-0">
                                        <select 
                                            value={social.platform} 
                                            onChange={(e) => handleUpdateSocial(social.id, { platform: e.target.value })}
                                            className="px-2 py-1 text-sm bg-background border rounded-md focus:ring-2 focus:ring-primary outline-none"
                                        >
                                            <option value="instagram">Instagram</option>
                                            <option value="facebook">Facebook</option>
                                            <option value="twitter">Twitter/X</option>
                                            <option value="whatsapp">WhatsApp</option>
                                            <option value="youtube">YouTube</option>
                                            <option value="other">Other/Website</option>
                                        </select>
                                    </div>
                                    <div className="flex-grow w-full">
                                        <Input 
                                            placeholder="Enter Full URL (e.g. https://...)" 
                                            value={social.url} 
                                            onChange={(e) => handleUpdateSocial(social.id, { url: e.target.value })}
                                            className="h-9"
                                        />
                                    </div>
                                    <div className="flex items-center gap-2 ml-auto">
                                        <Button 
                                            variant="ghost" 
                                            size="icon" 
                                            className="h-9 w-9 text-muted-foreground hover:text-primary"
                                            onClick={() => handleUpdateSocial(social.id, { enabled: !social.enabled })}
                                            title={social.enabled ? "Enabled" : "Disabled"}
                                        >
                                            {social.enabled ? <ToggleRight className="w-6 h-6 text-primary" /> : <ToggleLeft className="w-6 h-6" />}
                                        </Button>
                                        <Button 
                                            variant="ghost" 
                                            size="icon" 
                                            className="h-9 w-9 text-destructive hover:bg-destructive/10"
                                            onClick={() => handleRemoveSocial(social.id)}
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <Button variant="outline" className="w-full gap-2 mt-2" onClick={handleAddSocial}>
                            <Plus className="w-4 h-4" /> Add Social Handle
                        </Button>
                    </CardContent>
                    <CardFooter className="pt-6 border-t">
                        <Button className="w-full gap-2 h-12 text-lg font-bold" onClick={handleSave} disabled={isSaving}>
                            {isSaving ? <><RefreshCw className="animate-spin w-5 h-5" /> Saving...</> : <><Save className="w-5 h-5" /> Save Changes</>}
                        </Button>
                    </CardFooter>
                </Card>

                <div className="text-center">
                    <p className="text-sm text-muted-foreground">Changes will reflect instantly in the app footer.</p>
                </div>
            </div>
        </div>
    );
};

export default SocialAdmin;
