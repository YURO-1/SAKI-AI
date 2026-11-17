package ke.saki.backend.analysis;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

import ke.saki.backend.idea.BusinessIdea;

@Entity
@Table(name = "business_analyses")
public class BusinessAnalysis {
    @Id
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "business_idea_id", nullable = false)
    private BusinessIdea businessIdea;

    @Column(name = "result_json", nullable = false, columnDefinition = "text")
    private String resultJson;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected BusinessAnalysis() {
    }

    public BusinessAnalysis(BusinessIdea businessIdea, String resultJson) {
        this.id = UUID.randomUUID();
        this.businessIdea = businessIdea;
        this.resultJson = resultJson;
    }

    @PrePersist
    void setCreatedAt() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
    }

    public UUID getId() { return id; }
    public BusinessIdea getBusinessIdea() { return businessIdea; }
    public String getResultJson() { return resultJson; }
    public Instant getCreatedAt() { return createdAt; }
}
