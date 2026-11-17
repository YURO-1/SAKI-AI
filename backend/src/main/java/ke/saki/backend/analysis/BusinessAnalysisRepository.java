package ke.saki.backend.analysis;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

public interface BusinessAnalysisRepository extends JpaRepository<BusinessAnalysis, UUID> {
    List<BusinessAnalysis> findAllByBusinessIdeaIdOrderByCreatedAtDesc(UUID ideaId);

    Optional<BusinessAnalysis> findByIdAndBusinessIdeaOwnerId(UUID id, UUID ownerId);

    void deleteAllByBusinessIdeaId(UUID ideaId);
}
