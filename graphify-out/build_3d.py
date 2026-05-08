"""Build graph_3d.html with embedded data and 3d-force-graph viewer."""
import json, re
from pathlib import Path
from networkx.readwrite import json_graph

data = json.loads(Path('graphify-out/graph.json').read_text(encoding='utf-8'))
G = json_graph.node_link_graph(data, edges='links')

report = Path('graphify-out/GRAPH_REPORT.md').read_text(encoding='utf-8')
labels = {int(m.group(1)): m.group(2) for m in re.finditer(r'### Community (\d+) - "([^"]+)"', report)}

nodes_payload = []
for nid, ndata in G.nodes(data=True):
    cid = int(ndata.get('community', 0))
    nodes_payload.append({
        'id': nid,
        'label': ndata.get('label', nid),
        'community': cid,
        'community_label': labels.get(cid, f'C{cid}'),
        'source_file': ndata.get('source_file') or '',
        'file_type': ndata.get('file_type', ''),
        'degree': G.degree(nid),
    })

links_payload = []
for u, v, edata in G.edges(data=True):
    links_payload.append({
        'source': u,
        'target': v,
        'relation': edata.get('relation', ''),
        'confidence': edata.get('confidence', ''),
    })

payload = {'nodes': nodes_payload, 'links': links_payload}
print(f'Payload: {len(nodes_payload)} nodes / {len(links_payload)} links')
embedded_json = json.dumps(payload, ensure_ascii=False)

template = Path('graphify-out/graph_3d_template.html').read_text(encoding='utf-8')
html_final = template.replace('__GRAPH_DATA__', embedded_json)
out = Path('graphify-out/graph_3d.html')
out.write_text(html_final, encoding='utf-8')
print(f'graph_3d.html: {out.stat().st_size:,} bytes')
