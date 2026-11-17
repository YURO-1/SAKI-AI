package ke.saki.backend.idea;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

public interface BusinessIdeaRepository extends JpaRepository<BusinessIdea, UUID> {
    List<BusinessIdea> findAllByOwnerIdOrderByCreatedAtDesc(UUID ownerId);

    Optional<BusinessIdea> findByIdAndOwnerId(UUID id, UUID ownerId);
}
