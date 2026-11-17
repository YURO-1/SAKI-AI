package ke.saki.backend.idea;

import java.time.Instant;
import java.util.UUID;

public record BusinessIdeaView(
        UUID id,
        String name,
        String sectorGroup,
        String location,
        String premisesGroup,
        double initialCapitalKsh,
        boolean registered,
        int mainBuyerCode,
        int capitalSourceCode,
        int foundingEmployees,
        Instant createdAt) {
}
