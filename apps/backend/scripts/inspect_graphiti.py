import inspect
from graphiti_core import Graphiti
print(f"iscoroutinefunction(add_episode): {inspect.iscoroutinefunction(Graphiti.add_episode)}")
print(f"iscoroutinefunction(search): {inspect.iscoroutinefunction(Graphiti.search)}")
print(f"isfunction: {inspect.isfunction(Graphiti.add_episode)}")
