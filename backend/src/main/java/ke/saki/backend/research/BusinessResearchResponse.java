package ke.saki.backend.research;

import java.time.Instant;
import java.util.List;

public record BusinessResearchResponse(
        Instant retrievedAt,
        String sector,
        String geography,
        String businessType,
        String query,
        List<String> keySignals,
        List<ResearchResult> results) {

    public record ResearchResult(
            String title,
            String url,
            String snippet,
            String publishedDate,
            List<String> matchedTopics) {
    }
}
