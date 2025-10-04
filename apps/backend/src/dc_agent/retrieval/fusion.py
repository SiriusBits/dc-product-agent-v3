"""Result fusion algorithms for combining vector and knowledge graph results."""

import logging

from ..models.api_models import RetrievalResult

logger = logging.getLogger(__name__)


class ResultFusion:
    """Algorithms for fusing results from different retrieval sources."""

    @staticmethod
    def weighted_score_fusion(
        vector_results: list[RetrievalResult],
        kg_results: list[RetrievalResult],
        vector_weight: float = 0.5,
        kg_weight: float = 0.5,
        max_results: int = 20
    ) -> list[RetrievalResult]:
        """Fuse results using weighted scoring.
        
        Args:
            vector_results: Results from vector search
            kg_results: Results from knowledge graph search
            vector_weight: Weight for vector results
            kg_weight: Weight for knowledge graph results
            max_results: Maximum number of results to return
            
        Returns:
            Fused and ranked results
        """
        try:
            # Normalize weights
            total_weight = vector_weight + kg_weight
            if total_weight > 0:
                vector_weight /= total_weight
                kg_weight /= total_weight
            else:
                vector_weight, kg_weight = 0.5, 0.5

            # Apply weights to scores
            weighted_vector = []
            for result in vector_results:
                weighted_result = result.model_copy()
                weighted_result.score = result.score * vector_weight
                weighted_result.metadata["original_score"] = result.score
                weighted_result.metadata["weight_applied"] = vector_weight
                weighted_vector.append(weighted_result)

            weighted_kg = []
            for result in kg_results:
                weighted_result = result.model_copy()
                weighted_result.score = result.score * kg_weight
                weighted_result.metadata["original_score"] = result.score
                weighted_result.metadata["weight_applied"] = kg_weight
                weighted_kg.append(weighted_result)

            # Combine and deduplicate
            all_results = weighted_vector + weighted_kg
            deduplicated = ResultFusion._deduplicate_results(all_results)

            # Sort by weighted score
            deduplicated.sort(key=lambda x: x.score, reverse=True)

            # Mark as hybrid source
            for result in deduplicated:
                if result.source in ["vector", "kg"]:
                    result.source = "hybrid"
                    result.metadata["fusion_algorithm"] = "weighted_score"

            logger.info(f"Fused {len(vector_results)} vector + {len(kg_results)} KG results into {len(deduplicated)} results")
            return deduplicated[:max_results]

        except Exception as e:
            logger.error(f"Failed to perform weighted score fusion: {e}")
            # Fallback: return original results
            return (vector_results + kg_results)[:max_results]

    @staticmethod
    def reciprocal_rank_fusion(
        vector_results: list[RetrievalResult],
        kg_results: list[RetrievalResult],
        k: int = 60,
        max_results: int = 20
    ) -> list[RetrievalResult]:
        """Fuse results using Reciprocal Rank Fusion (RRF).
        
        Args:
            vector_results: Results from vector search
            kg_results: Results from knowledge graph search
            k: RRF parameter (typically 60)
            max_results: Maximum number of results to return
            
        Returns:
            Fused and ranked results
        """
        try:
            # Create mapping from content to results for deduplication
            content_to_results = {}

            # Process vector results
            for rank, result in enumerate(vector_results):
                content_key = ResultFusion._get_content_key(result)
                if content_key not in content_to_results:
                    content_to_results[content_key] = {
                        "result": result.model_copy(),
                        "rrf_score": 0.0,
                        "vector_rank": None,
                        "kg_rank": None,
                    }

                # Add RRF score contribution from vector ranking
                content_to_results[content_key]["rrf_score"] += 1.0 / (k + rank + 1)
                content_to_results[content_key]["vector_rank"] = rank + 1

            # Process KG results
            for rank, result in enumerate(kg_results):
                content_key = ResultFusion._get_content_key(result)
                if content_key not in content_to_results:
                    content_to_results[content_key] = {
                        "result": result.model_copy(),
                        "rrf_score": 0.0,
                        "vector_rank": None,
                        "kg_rank": None,
                    }

                # Add RRF score contribution from KG ranking
                content_to_results[content_key]["rrf_score"] += 1.0 / (k + rank + 1)
                content_to_results[content_key]["kg_rank"] = rank + 1

            # Create final results with RRF scores
            fused_results = []
            for item in content_to_results.values():
                result = item["result"]
                result.score = item["rrf_score"]
                result.source = "hybrid"
                result.metadata.update({
                    "original_score": result.metadata.get("original_score", result.score),
                    "rrf_score": item["rrf_score"],
                    "vector_rank": item["vector_rank"],
                    "kg_rank": item["kg_rank"],
                    "fusion_algorithm": "reciprocal_rank",
                })
                fused_results.append(result)

            # Sort by RRF score
            fused_results.sort(key=lambda x: x.score, reverse=True)

            logger.info(f"RRF fused {len(vector_results)} vector + {len(kg_results)} KG results into {len(fused_results)} results")
            return fused_results[:max_results]

        except Exception as e:
            logger.error(f"Failed to perform RRF fusion: {e}")
            # Fallback: return original results
            return (vector_results + kg_results)[:max_results]

    @staticmethod
    def interleaved_fusion(
        vector_results: list[RetrievalResult],
        kg_results: list[RetrievalResult],
        vector_ratio: float = 0.6,
        max_results: int = 20
    ) -> list[RetrievalResult]:
        """Fuse results by interleaving based on ratio.
        
        Args:
            vector_results: Results from vector search
            kg_results: Results from knowledge graph search
            vector_ratio: Ratio of vector results to include
            max_results: Maximum number of results to return
            
        Returns:
            Interleaved results
        """
        try:
            fused_results = []
            vector_idx = 0
            kg_idx = 0

            # Calculate how many results to take from each source
            vector_count = int(max_results * vector_ratio)
            kg_count = max_results - vector_count

            # Interleave results
            while len(fused_results) < max_results:
                # Add vector result if available and within ratio
                if (vector_idx < len(vector_results) and
                    len([r for r in fused_results if r.metadata.get("original_source") == "vector"]) < vector_count):
                    result = vector_results[vector_idx].model_copy()
                    result.source = "hybrid"
                    result.metadata["original_source"] = "vector"
                    result.metadata["fusion_algorithm"] = "interleaved"
                    result.metadata["interleave_position"] = len(fused_results)
                    fused_results.append(result)
                    vector_idx += 1

                # Add KG result if available and within ratio
                if (kg_idx < len(kg_results) and
                    len([r for r in fused_results if r.metadata.get("original_source") == "kg"]) < kg_count):
                    result = kg_results[kg_idx].model_copy()
                    result.source = "hybrid"
                    result.metadata["original_source"] = "kg"
                    result.metadata["fusion_algorithm"] = "interleaved"
                    result.metadata["interleave_position"] = len(fused_results)
                    fused_results.append(result)
                    kg_idx += 1

                # Break if no more results available
                if vector_idx >= len(vector_results) and kg_idx >= len(kg_results):
                    break

            # Deduplicate while preserving order
            deduplicated = ResultFusion._deduplicate_results_preserve_order(fused_results)

            logger.info(f"Interleaved {len(vector_results)} vector + {len(kg_results)} KG results into {len(deduplicated)} results")
            return deduplicated[:max_results]

        except Exception as e:
            logger.error(f"Failed to perform interleaved fusion: {e}")
            # Fallback: return original results
            return (vector_results + kg_results)[:max_results]

    @staticmethod
    def confidence_based_fusion(
        vector_results: list[RetrievalResult],
        kg_results: list[RetrievalResult],
        confidence_threshold: float = 0.7,
        max_results: int = 20
    ) -> list[RetrievalResult]:
        """Fuse results based on confidence scores.
        
        Args:
            vector_results: Results from vector search
            kg_results: Results from knowledge graph search
            confidence_threshold: Threshold for high confidence results
            max_results: Maximum number of results to return
            
        Returns:
            Confidence-based fused results
        """
        try:
            # Separate high and low confidence results
            high_confidence = []
            low_confidence = []

            for result in vector_results + kg_results:
                result_copy = result.model_copy()
                result_copy.metadata["fusion_algorithm"] = "confidence_based"

                if result.score >= confidence_threshold:
                    high_confidence.append(result_copy)
                else:
                    low_confidence.append(result_copy)

            # Sort each group by score
            high_confidence.sort(key=lambda x: x.score, reverse=True)
            low_confidence.sort(key=lambda x: x.score, reverse=True)

            # Combine: high confidence first, then low confidence
            fused_results = high_confidence + low_confidence

            # Deduplicate
            deduplicated = ResultFusion._deduplicate_results(fused_results)

            # Mark as hybrid source
            for result in deduplicated:
                if result.source in ["vector", "kg"]:
                    result.source = "hybrid"

            logger.info(f"Confidence-based fusion: {len(high_confidence)} high confidence, {len(low_confidence)} low confidence")
            return deduplicated[:max_results]

        except Exception as e:
            logger.error(f"Failed to perform confidence-based fusion: {e}")
            # Fallback: return original results
            return (vector_results + kg_results)[:max_results]

    @staticmethod
    def _deduplicate_results(results: list[RetrievalResult]) -> list[RetrievalResult]:
        """Remove duplicate results based on content similarity."""
        try:
            seen_content = set()
            deduplicated = []

            for result in results:
                content_key = ResultFusion._get_content_key(result)

                if content_key not in seen_content:
                    seen_content.add(content_key)
                    deduplicated.append(result)
                else:
                    # If duplicate, keep the one with higher score
                    existing_idx = None
                    for i, existing in enumerate(deduplicated):
                        if ResultFusion._get_content_key(existing) == content_key:
                            existing_idx = i
                            break

                    if existing_idx is not None and result.score > deduplicated[existing_idx].score:
                        deduplicated[existing_idx] = result

            return deduplicated

        except Exception as e:
            logger.error(f"Failed to deduplicate results: {e}")
            return results

    @staticmethod
    def _deduplicate_results_preserve_order(results: list[RetrievalResult]) -> list[RetrievalResult]:
        """Remove duplicate results while preserving order."""
        try:
            seen_content = set()
            deduplicated = []

            for result in results:
                content_key = ResultFusion._get_content_key(result)

                if content_key not in seen_content:
                    seen_content.add(content_key)
                    deduplicated.append(result)

            return deduplicated

        except Exception as e:
            logger.error(f"Failed to deduplicate results preserving order: {e}")
            return results

    @staticmethod
    def _get_content_key(result: RetrievalResult) -> str:
        """Generate a key for content deduplication."""
        try:
            # Use first 100 characters of content as key
            content_key = result.content[:100].strip().lower()

            # Add document ID if available for better deduplication
            doc_id = result.metadata.get("document_id") or result.provenance.get("document_id")
            if doc_id:
                content_key += f"__{doc_id}"

            return content_key

        except Exception as e:
            logger.error(f"Failed to generate content key: {e}")
            return result.content[:50]  # Fallback
