"""add_parent_consent_created_at

Revision ID: ff67fb481bcb
Revises: 
Create Date: 2026-10-03 10:55:28.335377

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'ff67fb481bcb'
down_revision: Union[str, Sequence[str], None] = '0001_initial_schema'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    bind = op.get_bind()
    insp = sa.inspect(bind)

    def has_index(table: str, idx_name: str) -> bool:
        if not insp.has_table(table):
            return False
        return any(i.get('name') == idx_name for i in insp.get_indexes(table))

    def has_column(table: str, col_name: str) -> bool:
        if not insp.has_table(table):
            return False
        return any(c.get('name') == col_name for c in insp.get_columns(table))

    if not has_index('answers', 'ix_answers_question_id'):
        with op.batch_alter_table('answers', schema=None) as batch_op:
            batch_op.create_index(batch_op.f('ix_answers_question_id'), ['question_id'], unique=False)

    if not has_index('document_chunks', 'ix_document_chunks_document_id'):
        with op.batch_alter_table('document_chunks', schema=None) as batch_op:
            batch_op.create_index(batch_op.f('ix_document_chunks_document_id'), ['document_id'], unique=False)

    if not has_index('documents', 'ix_documents_user_id'):
        with op.batch_alter_table('documents', schema=None) as batch_op:
            batch_op.create_index(batch_op.f('ix_documents_user_id'), ['user_id'], unique=False)

    if not has_index('evaluations', 'ix_evaluations_answer_id'):
        with op.batch_alter_table('evaluations', schema=None) as batch_op:
            batch_op.create_index(batch_op.f('ix_evaluations_answer_id'), ['answer_id'], unique=False)

    if not has_index('llm_usage_logs', 'ix_llm_usage_logs_session_id'):
        with op.batch_alter_table('llm_usage_logs', schema=None) as batch_op:
            batch_op.create_index(batch_op.f('ix_llm_usage_logs_session_id'), ['session_id'], unique=False)

    with op.batch_alter_table('parent_consents', schema=None) as batch_op:
        if not has_column('parent_consents', 'created_at'):
            batch_op.add_column(sa.Column('created_at', sa.DateTime(), nullable=True))
        batch_op.alter_column('consent_token',
               existing_type=sa.TEXT(),
               type_=sa.String(),
               existing_nullable=True)
        if not has_index('parent_consents', 'ix_parent_consents_user_id'):
            batch_op.create_index(batch_op.f('ix_parent_consents_user_id'), ['user_id'], unique=False)

    if not has_index('questions', 'ix_questions_parent_question_id') or not has_index('questions', 'ix_questions_session_id'):
        with op.batch_alter_table('questions', schema=None) as batch_op:
            if not has_index('questions', 'ix_questions_parent_question_id'):
                batch_op.create_index(batch_op.f('ix_questions_parent_question_id'), ['parent_question_id'], unique=False)
            if not has_index('questions', 'ix_questions_session_id'):
                batch_op.create_index(batch_op.f('ix_questions_session_id'), ['session_id'], unique=False)

    with op.batch_alter_table('reports', schema=None) as batch_op:
        batch_op.alter_column('status',
               existing_type=sa.TEXT(),
               type_=sa.String(),
               existing_nullable=True,
               existing_server_default=sa.text("'complete'"))
        if not has_index('reports', 'ix_reports_session_id'):
            batch_op.create_index(batch_op.f('ix_reports_session_id'), ['session_id'], unique=True)

    with op.batch_alter_table('sessions', schema=None) as batch_op:
        batch_op.alter_column('language',
               existing_type=sa.TEXT(),
               type_=sa.String(),
               existing_nullable=True,
               existing_server_default=sa.text("'en-IN'"))
        batch_op.alter_column('active_followup_id',
               existing_type=sa.TEXT(),
               type_=sa.String(),
               existing_nullable=True)
        if not has_index('sessions', 'ix_sessions_document_id'):
            batch_op.create_index(batch_op.f('ix_sessions_document_id'), ['document_id'], unique=False)
        if not has_index('sessions', 'ix_sessions_user_id'):
            batch_op.create_index(batch_op.f('ix_sessions_user_id'), ['user_id'], unique=False)

    if not has_index('topic_scores', 'ix_topic_scores_report_id'):
        with op.batch_alter_table('topic_scores', schema=None) as batch_op:
            batch_op.create_index(batch_op.f('ix_topic_scores_report_id'), ['report_id'], unique=False)

    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.alter_column('email',
               existing_type=sa.VARCHAR(),
               nullable=False)
        batch_op.alter_column('password_hash',
               existing_type=sa.TEXT(),
               type_=sa.String(),
               existing_nullable=True)
        batch_op.alter_column('account_status',
               existing_type=sa.TEXT(),
               type_=sa.String(),
               nullable=True,
               existing_server_default=sa.text("'active'"))

    # ### end Alembic commands ###


def downgrade() -> None:
    """Downgrade schema."""
    # ### commands auto generated by Alembic - please adjust! ###
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.alter_column('account_status',
               existing_type=sa.String(),
               type_=sa.TEXT(),
               nullable=False,
               existing_server_default=sa.text("'active'"))
        batch_op.alter_column('password_hash',
               existing_type=sa.String(),
               type_=sa.TEXT(),
               existing_nullable=True)
        batch_op.alter_column('email',
               existing_type=sa.VARCHAR(),
               nullable=True)

    with op.batch_alter_table('topic_scores', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_topic_scores_report_id'))

    with op.batch_alter_table('sessions', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_sessions_user_id'))
        batch_op.drop_index(batch_op.f('ix_sessions_document_id'))
        batch_op.alter_column('active_followup_id',
               existing_type=sa.String(),
               type_=sa.TEXT(),
               existing_nullable=True)
        batch_op.alter_column('language',
               existing_type=sa.String(),
               type_=sa.TEXT(),
               existing_nullable=True,
               existing_server_default=sa.text("'en-IN'"))

    with op.batch_alter_table('reports', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_reports_session_id'))
        batch_op.alter_column('status',
               existing_type=sa.String(),
               type_=sa.TEXT(),
               existing_nullable=True,
               existing_server_default=sa.text("'complete'"))

    with op.batch_alter_table('questions', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_questions_session_id'))
        batch_op.drop_index(batch_op.f('ix_questions_parent_question_id'))

    with op.batch_alter_table('parent_consents', schema=None) as batch_op:
        # WARNING: constraint name is None; this directive will fail as
        # rendered.  Add a name, or use a naming convention; see
        # https://alembic.sqlalchemy.org/en/latest/naming.html
        batch_op.drop_constraint(None, type_='unique')
        batch_op.drop_index(batch_op.f('ix_parent_consents_user_id'))
        batch_op.alter_column('consent_token',
               existing_type=sa.String(),
               type_=sa.TEXT(),
               existing_nullable=True)
        batch_op.drop_column('created_at')

    with op.batch_alter_table('llm_usage_logs', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_llm_usage_logs_session_id'))

    with op.batch_alter_table('evaluations', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_evaluations_answer_id'))

    with op.batch_alter_table('documents', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_documents_user_id'))

    with op.batch_alter_table('document_chunks', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_document_chunks_document_id'))

    with op.batch_alter_table('answers', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_answers_question_id'))

    # ### end Alembic commands ###
