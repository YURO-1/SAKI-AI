package ke.saki.backend.idea;

import java.util.List;
import java.util.UUID;

import ke.saki.backend.analysis.BusinessAnalysisRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import ke.saki.backend.user.UserAccount;
import ke.saki.backend.user.UserAccountRepository;

@Service
@Transactional
public class BusinessIdeaService {
    private final BusinessIdeaRepository ideas;
    private final UserAccountRepository users;
    private final BusinessAnalysisRepository analyses;

    public BusinessIdeaService(
            BusinessIdeaRepository ideas,
            UserAccountRepository users,
            BusinessAnalysisRepository analyses) {
        this.ideas = ideas;
        this.users = users;
        this.analyses = analyses;
    }

    public BusinessIdeaView create(String email, BusinessIdeaRequest request) {
        UserAccount owner = findUser(email);
        return view(ideas.save(new BusinessIdea(owner, request)));
    }

    @Transactional(readOnly = true)
    public List<BusinessIdeaView> list(String email) {
        UUID ownerId = findUser(email).getId();
        return ideas.findAllByOwnerIdOrderByCreatedAtDesc(ownerId).stream().map(this::view).toList();
    }

    @Transactional(readOnly = true)
    public BusinessIdeaView get(String email, UUID id) {
        return view(findIdea(email, id));
    }

    public BusinessIdeaView update(String email, UUID id, BusinessIdeaRequest request) {
        BusinessIdea idea = findIdea(email, id);
        idea.update(request);
        return view(ideas.save(idea));
    }

    public void delete(String email, UUID id) {
        BusinessIdea idea = findIdea(email, id);
        analyses.deleteAllByBusinessIdeaId(idea.getId());
        ideas.delete(idea);
    }

    public BusinessIdea findIdea(String email, UUID id) {
        UUID ownerId = findUser(email).getId();
        return ideas.findByIdAndOwnerId(id, ownerId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Business idea not found."));
    }

    private UserAccount findUser(String email) {
        return users.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User account not found."));
    }

    private BusinessIdeaView view(BusinessIdea idea) {
        return new BusinessIdeaView(
                idea.getId(),
                idea.getName(),
                idea.getSectorGroup(),
                idea.getLocation(),
                idea.getPremisesGroup(),
                idea.getInitialCapitalKsh(),
                idea.isRegistered(),
                idea.getMainBuyerCode(),
                idea.getCapitalSourceCode(),
                idea.getFoundingEmployees(),
                idea.getCreatedAt());
    }
}
