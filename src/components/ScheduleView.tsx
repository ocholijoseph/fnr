import { Calendar, Clock } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

// Mock schedule data - will be replaced with API data
const mockSchedule = [
    {
        id: "1",
        name: "Morning Show",
        startTime: "06:00",
        endTime: "09:00",
        description: "Start your morning with energy",
    },
    {
        id: "2",
        name: "Street Wise",
        startTime: "09:00",
        endTime: "12:00",
        description: "Navigating the rhythm of the streets",
    },
    {
        id: "3",
        name: "Good Afternoon",
        startTime: "12:00",
        endTime: "16:00",
        description: "Your perfect companion for the afternoon",
    },
    {
        id: "4",
        name: "Be Real",
        startTime: "16:00",
        endTime: "19:00",
        description: "Keeping it 100 with the best music",
    },
    {
        id: "5",
        name: "Raw!",
        startTime: "19:00",
        endTime: "22:00",
        description: "Unfiltered sounds and pure vibes",
    },
    {
        id: "6",
        name: "Night Vibes",
        startTime: "22:00",
        endTime: "02:00",
        description: "Smooth tunes for the late night",
    },
    {
        id: "7",
        name: "Meditation",
        startTime: "02:00",
        endTime: "06:00",
        description: "Soulful sounds for your inner peace",
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