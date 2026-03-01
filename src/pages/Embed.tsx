import { RadioPlayer } from "@/components/RadioPlayer";
import { useSearchParams } from "react-router-dom";

const Embed = () => {
    const [searchParams] = useSearchParams();
    const stationId = searchParams.get("station");

    // Mock data - in production, fetch based on stationId
    const station = {
        title: "Freedom Naija Radio",
        streamUrl: "http://69.197.134.188:8000/live",
        thumbnail: "/fulllogo.png",
        isLive: true,
    };

    const currentTrack = {
        title: "Electric Dreams",
        artist: "Midnight Riders",
        thumbnail: "/fulllogo.png",
    };

    return (
        <div className="h-full bg-background flex items-center justify-center p-4">
            <div className="w-full">
                <RadioPlayer
                    station={station}
                    currentTrack={currentTrack}
                    history={[]}
                />
            </div>
        </div>
    );
};

export default Embed;
