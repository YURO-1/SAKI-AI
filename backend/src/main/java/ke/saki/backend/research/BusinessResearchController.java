package ke.saki.backend.research;

import java.util.Map;
import java.util.UUID;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/ideas/{ideaId}/research")
public class BusinessResearchController {
    private final BusinessResearchService service;

    public BusinessResearchController(BusinessResearchService service) {
        this.service = service;
    }

    @PostMapping
    public BusinessResearchResponse research(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID ideaId) {
        return service.research(jwt.getSubject(), ideaId);
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<Map<String, String>> handleResearchError(ResponseStatusException exception) {
        String message = exception.getReason() == null
                ? "Online research could not be completed."
                : exception.getReason();
        return ResponseEntity.status(exception.getStatusCode()).body(Map.of("message", message));
    }
}
