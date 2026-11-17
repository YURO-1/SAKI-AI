package ke.saki.backend.idea;

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

import ke.saki.backend.user.UserAccount;

@Entity
@Table(name = "business_ideas")
public class BusinessIdea {
    @Id
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "owner_id", nullable = false)
    private UserAccount owner;

    @Column(nullable = false, length = 120)
    private String name;

    @Column(name = "sector_group", nullable = false, length = 80)
    private String sectorGroup;

    @Column(nullable = false, length = 120)
    private String location;

    @Column(name = "premises_group", nullable = false, length = 80)
    private String premisesGroup;

    @Column(name = "initial_capital_ksh", nullable = false)
    private double initialCapitalKsh;

    @Column(nullable = false)
    private boolean registered;

    @Column(name = "main_buyer_code", nullable = false)
    private int mainBuyerCode;

    @Column(name = "capital_source_code", nullable = false)
    private int capitalSourceCode;

    @Column(name = "founding_employees", nullable = false)
    private int foundingEmployees;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected BusinessIdea() {
    }

    public BusinessIdea(UserAccount owner, BusinessIdeaRequest request) {
        this.id = UUID.randomUUID();
        this.owner = owner;
        update(request);
    }

    public void update(BusinessIdeaRequest request) {
        this.name = request.name().trim();
        this.sectorGroup = request.sectorGroup();
        this.location = request.location().trim();
        this.premisesGroup = request.premisesGroup();
        this.initialCapitalKsh = request.initialCapitalKsh();
        this.registered = request.registered();
        this.mainBuyerCode = request.mainBuyerCode();
        this.capitalSourceCode = request.capitalSourceCode();
        this.foundingEmployees = request.foundingEmployees();
    }

    @PrePersist
    void setCreatedAt() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
    }

    public UUID getId() { return id; }
    public UserAccount getOwner() { return owner; }
    public String getName() { return name; }
    public String getSectorGroup() { return sectorGroup; }
    public String getLocation() { return location; }
    public String getPremisesGroup() { return premisesGroup; }
    public double getInitialCapitalKsh() { return initialCapitalKsh; }
    public boolean isRegistered() { return registered; }
    public int getMainBuyerCode() { return mainBuyerCode; }
    public int getCapitalSourceCode() { return capitalSourceCode; }
    public int getFoundingEmployees() { return foundingEmployees; }
    public Instant getCreatedAt() { return createdAt; }
}
