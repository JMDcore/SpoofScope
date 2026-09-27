"""snapshots and disappearance tracking"""

import sqlalchemy as sa
from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "assets", sa.Column("missing_scans", sa.Integer(), nullable=False, server_default="0")
    )
    op.add_column("assets", sa.Column("disappeared_at", sa.DateTime(timezone=True)))
    op.add_column(
        "candidates", sa.Column("missing_scans", sa.Integer(), nullable=False, server_default="0")
    )
    op.add_column("candidates", sa.Column("disappeared_at", sa.DateTime(timezone=True)))
    op.create_table(
        "snapshots",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("scan_id", sa.Integer(), sa.ForeignKey("scans.id"), nullable=False),
        sa.Column("domain_id", sa.Integer(), sa.ForeignKey("domains.id"), nullable=False),
        sa.Column("subject_type", sa.String(24), nullable=False),
        sa.Column("subject_key", sa.String(253), nullable=False),
        sa.Column("state", sa.String(24), nullable=False),
        sa.Column("fingerprint", sa.String(64), nullable=False),
        sa.Column("data", sa.JSON(), nullable=False),
        sa.Column("observed_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("scan_id", "subject_type", "subject_key", name="uq_snapshot_subject"),
    )
    op.create_index("ix_snapshots_scan_id", "snapshots", ["scan_id"])
    op.create_index("ix_snapshots_domain_id", "snapshots", ["domain_id"])
    op.create_index("ix_snapshots_subject_type", "snapshots", ["subject_type"])
    op.create_index("ix_snapshots_subject_key", "snapshots", ["subject_key"])
    op.create_index("ix_snapshots_observed_at", "snapshots", ["observed_at"])


def downgrade():
    op.drop_table("snapshots")
    op.drop_column("candidates", "disappeared_at")
    op.drop_column("candidates", "missing_scans")
    op.drop_column("assets", "disappeared_at")
    op.drop_column("assets", "missing_scans")
