"""prevent duplicate inventory rows"""

from alembic import op

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("assets") as batch:
        batch.create_unique_constraint("uq_asset_domain_host", ["domain_id", "hostname"])
    with op.batch_alter_table("candidates") as batch:
        batch.create_unique_constraint("uq_candidate_domain_host", ["domain_id", "hostname"])


def downgrade():
    with op.batch_alter_table("candidates") as batch:
        batch.drop_constraint("uq_candidate_domain_host", type_="unique")
    with op.batch_alter_table("assets") as batch:
        batch.drop_constraint("uq_asset_domain_host", type_="unique")
