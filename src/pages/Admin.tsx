import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowLeft, Save, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Admin = () => {
    const [overrideEnabled, setOverrideEnabled] = useState(false);
    const [overrideMessage, setOverrideMessage] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const navigate = useNavigate();

    const fetchConfig = async () => {
        setIsLoading(true);
        try {
            const response = await fetch('/api/scroll');
            if (response.ok) {
                const data = await response.json();
                setOverrideEnabled(data.overrideEnabled);
                setOverrideMessage(data.overrideMessage);
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

    useEffect(() => {
        fetchConfig();
    }, []);

    const handleSave = async () => {
        if (overrideMessage.length > 300) {
            toast.error("Message too long (max 300 characters)");
            return;
        }

        setIsSaving(true);
        try {
            const response = await fetch('/api/scroll', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    overrideEnabled,
                    overrideMessage: overrideMessage.trim()
                })
            });

            if (response.ok) {
                toast.success("Settings updated successfully!");
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
        <div className="min-h-screen bg-background text-foreground p-6 max-w-2xl mx-auto space-y-8">
            <header className="flex items-center justify-between">
                <Button variant="ghost" onClick={() => navigate("/")} className="gap-2">
                    <ArrowLeft className="w-4 h-4" /> Back to Player
                </Button>
                <h1 className="text-2xl font-bold">CMS Admin</h1>
                <Button variant="outline" size="icon" onClick={fetchConfig} disabled={isLoading}>
                    <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                </Button>
            </header>

            <main className="space-y-6 bg-card p-6 rounded-xl border border-border shadow-sm">
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
        </div>
    );
};

export default Admin;
