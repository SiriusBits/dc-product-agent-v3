import inspect
from graphiti_core import Graphiti
print(f"iscoroutinefunction: {inspect.iscoroutinefunction(Graphiti.add_episode)}")
print(f"isfunction: {inspect.isfunction(Graphiti.add_episode)}")
