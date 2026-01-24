import { Calendar, Clock } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

// Mock schedule data - will be replaced with API data
const mockSchedule = [
    {
        id: "1",
        name: "Rise & Shine",
        startTime: "06:00",
        endTime: "09:00",
        description: "Devotion + AfroGospel",
    },
    {
        id: "2",
        name: "Praise Vibes",
        startTime: "09:00",
        endTime: "12:00",
        description: "Urban gospel",
    },
    {
        id: "3",
        name: "Kingdom Talk",
        startTime: "12:00",
        endTime: "15:00",
        description: "Talk + life",
    },
    {
        id: "4",
        name: "Traffic Praise",
        startTime: "15:00",
        endTime: "18:00",
        description: "Energy",
    },
    {
        id: "5",
        name: "Worship Lounge",
        startTime: "18:00",
        endTime: "21:00",
        description: "Deep worship",
    },
    {
        id: "6",
        name: "Consciousness",
        startTime: "21:00",
        endTime: "24:00",
        description: "Thoughtful time with refreshing raggae tunes",
    },
    {
        id: "7",
        name: "Prayer",
        startTime: "24:00",
        endTime: "01:00",
        description: "Night prayers",
    },
    {
        id: "8",
        name: "After Hours Revival",
        startTime: "01:00",
        endTime: "04:00",
        description: "Jazz through the night",
    },
    {
        id: "9",
        name: "Wake Up!",
        startTime: "04:00",
        endTime: "06:00",
        description: "Night prayers",
    },
];

const isCurrentProgram = (startTime: string, endTime: string) => {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTime = currentHour * 60 + currentMinute;

    const [startHour, startMinute] = startTime.split(":").map(Number);
    const [endHour, endMinute] = endTime.split(":").map(Number);
    const startMinutes = startHour * 60 + startMinute;
    const endMinutes = endHour * 60 + endMinute;

    if (endMinutes < startMinutes) {
        // Program crosses midnight
        return currentTime >= startMinutes || currentTime < endMinutes;
    }
    return currentTime >= startMinutes && currentTime < endMinutes;
};

export const ScheduleView = () => {
    return (
        <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-3">
                {mockSchedule.map((program) => {
                    const isCurrent = isCurrentProgram(program.startTime, program.endTime);

                    return (
                        <div
                            key={program.id}
                            className={`p-4 rounded-lg transition-colors ${isCurrent
                                ? "bg-primary/10 border-2 border-primary"
                                : "bg-secondary hover:bg-secondary/80"
                                }`}
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-2">
                                        <h3 className="font-semibold text-lg">{program.name}</h3>
                                        {isCurrent && (
                                            <Badge variant="default" className="animate-pulse-glow">
                                                ON AIR
                                            </Badge>
                                        )}
                                    </div>
                                    <p className="text-sm text-muted-foreground mb-2">
                                        {program.description}
                                    </p>
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <Clock className="h-4 w-4" />
                                        <span>
                                            {program.startTime} - {program.endTime}
                                        </span>
                                    </div>
                                </div>
                                <Calendar className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                            </div>
                        </div>
                    );
                })}
            </div>
        </ScrollArea>
    );
};