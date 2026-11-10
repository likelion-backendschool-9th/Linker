package com.linker.backend.repository.team;
import com.linker.backend.entity.team.TeamOwnershipTransfer;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
public interface TeamOwnershipTransferRepository extends JpaRepository<TeamOwnershipTransfer,Long> {
  Optional<TeamOwnershipTransfer> findByTeamIdAndStatus(long teamId,String status);
}
