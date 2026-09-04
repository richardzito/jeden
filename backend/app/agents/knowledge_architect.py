"""KnowledgeArchitect agent: assigns each concept an importance tier and
builds the prerequisite/relationship graph between concepts.

MVP note (spec section A.5 / I): this graph is stored as plain
`concept_relationships` rows (adjacency list), not a dedicated graph
engine -- a flat table is sufficient at MVP scale and keeps the schema
easy to extend later.
"""

from app.integrations.anthropic_client import AnthropicClient, ModelTier
from app.schemas.research import KnowledgeArchitectOutput

_SYSTEM = """You are structuring a set of learning concepts into a knowledge graph.

1. Assign each concept an importance tier:
   - core: essential to understanding the topic; nothing else makes sense without it
   - secondary: useful and reinforces understanding, but not strictly required
   - peripheral: interesting or advanced detail, useful for depth but skippable

2. Identify relationships between concepts:
   - prerequisite_of: concept A must be understood before concept B (use this to build a valid \
learning order -- avoid cycles)
   - related_to: concepts that connect but neither strictly requires the other
   - part_of: concept A is a sub-component of concept B
   - contrasts_with: concepts that are often confused or meaningfully contrasted

Only create relationships that meaningfully help a learner (do not connect every pair). \
Reference concepts by their exact given name."""


class KnowledgeArchitect:
    def __init__(self, client: AnthropicClient):
        self._client = client

    async def build_relationships(
        self, concept_names_with_definitions: list[tuple[str, str]], *, topic_id=None
    ) -> KnowledgeArchitectOutput:
        listing = "\n".join(f"- {name}: {definition}" for name, definition in concept_names_with_definitions)
        return await self._client.structured_call(
            agent_name="knowledge_architect.build_relationships",
            tier=ModelTier.sonnet,
            system=_SYSTEM,
            user_message=f"Concepts:\n{listing}",
            response_model=KnowledgeArchitectOutput,
            max_tokens=4096,
            topic_id=topic_id,
        )
