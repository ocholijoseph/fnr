import React, { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface SubmissionField {
    id: string;
    label: string;
    type: "text" | "email" | "textarea" | "checkbox";
    placeholder?: string;
    required?: boolean;
    minLength?: number;
}

interface SubmissionModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    description?: string;
    fields: SubmissionField[];
    endpoint: string;
    successMessage: string;
}

const SubmissionModal = ({
    isOpen,
    onClose,
    title,
    description,
    fields,
    endpoint,
    successMessage,
}: SubmissionModalProps) => {
    const [formData, setFormData] = useState<Record<string, any>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});

    const validate = () => {
        const newErrors: Record<string, string> = {};
        fields.forEach((field) => {
            const value = formData[field.id];
            if (field.required && !value && field.type !== "checkbox") {
                newErrors[field.id] = `${field.label} is required`;
            } else if (field.type === "email" && value && !/\S+@\S+\.\S+/.test(value)) {
                newErrors[field.id] = "Invalid email address";
            } else if (field.minLength && value && value.length < field.minLength) {
                newErrors[field.id] = `${field.label} must be at least ${field.minLength} characters`;
            }
        });
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validate()) return;

        setIsSubmitting(true);
        try {
            const response = await fetch(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData),
            });

            if (response.ok) {
                toast.success(successMessage);
                setFormData({});
                setTimeout(onClose, 2000);
            } else {
                const errorData = await response.json().catch(() => ({}));
                toast.error(errorData.error || "Failed to submit. Please try again.");
            }
        } catch (error) {
            console.error("Submission error:", error);
            toast.error("Connection error. Please check your internet.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleFieldChange = (id: string, value: any) => {
        setFormData((prev) => ({ ...prev, [id]: value }));
        if (errors[id]) {
            setErrors((prev) => {
                const updated = { ...prev };
                delete updated[id];
                return updated;
            });
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-[425px] bg-card border-border">
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold">{title}</DialogTitle>
                    {description && (
                        <DialogDescription className="text-muted-foreground">
                            {description}
                        </DialogDescription>
                    )}
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 py-4">
                    {fields.map((field) => (
                        <div key={field.id} className="space-y-2">
                            {field.type !== "checkbox" && (
                                <Label htmlFor={field.id} className="text-sm font-medium">
                                    {field.label} {field.required && <span className="text-destructive">*</span>}
                                </Label>
                            )}

                            {field.type === "textarea" ? (
                                <Textarea
                                    id={field.id}
                                    placeholder={field.placeholder}
                                    value={formData[field.id] || ""}
                                    onChange={(e) => handleFieldChange(field.id, e.target.value)}
                                    className={`${errors[field.id] ? "border-destructive" : ""} min-h-[100px]`}
                                />
                            ) : field.type === "checkbox" ? (
                                <div className="flex items-center space-x-2 py-2">
                                    <Checkbox
                                        id={field.id}
                                        checked={formData[field.id] || false}
                                        onCheckedChange={(checked) => handleFieldChange(field.id, checked)}
                                    />
                                    <Label htmlFor={field.id} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                        {field.label}
                                    </Label>
                                </div>
                            ) : (
                                <Input
                                    id={field.id}
                                    type={field.type}
                                    placeholder={field.placeholder}
                                    value={formData[field.id] || ""}
                                    onChange={(e) => handleFieldChange(field.id, e.target.value)}
                                    className={errors[field.id] ? "border-destructive" : ""}
                                />
                            )}
                            {errors[field.id] && (
                                <p className="text-xs text-destructive mt-1 font-medium">{errors[field.id]}</p>
                            )}
                        </div>
                    ))}
                    <DialogFooter className="pt-4 flex sm:justify-between gap-3">
                        <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isSubmitting} className="min-w-[100px]">
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Sending...
                                </>
                            ) : (
                                "Submit"
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};

export default SubmissionModal;
