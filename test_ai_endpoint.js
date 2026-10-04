async function test() {
  const payload = {
    scene: {
      site: { length: 60, width: 35, unit: 'meters' },
      temple: { name: 'Test Temple' },
      requirements: { expectedVisitors: 5000, peakVisitors: 1500 },
      components: []
    },
    prompt: 'Design a queue for 1500 peak visitors with one entrance and two security checkpoints.',
    mode: 'generate',
    allowFallback: true
  };
  const res = await fetch('http://localhost:5001/api/ai/layout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  console.log('Status:', res.status);
  console.log('Success:', data.success);
  console.log('Recs count:', data.recommendations?.length);
  data.recommendations?.forEach((r, idx) => {
    console.log(
      'Option ' + (idx + 1) + ': ' + r.title + 
      ' | template: ' + r.intent.template + 
      ' | lanes: ' + r.intent.lanes + 
      ' | fits: ' + r.fits + 
      ' | capacity: ' + r.analysis.metrics.queueCapacity + 
      ' | util: ' + r.analysis.metrics.utilization + '%' +
      ' | wait: ' + r.analysis.metrics.estimatedWaitMinutes + 'm'
    );
  });

  console.log('\n--- Testing Optimize Mode ---');
  const optRes = await fetch('http://localhost:5001/api/ai/layout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      scene: payload.scene,
      prompt: 'Optimize queue capacity and minimize wait times',
      mode: 'optimize',
      allowFallback: true
    })
  });
  const optData = await optRes.json();
  console.log('Optimize Success:', optData.success);
  console.log('Recommendation:', optData.recommendation?.title);
  console.log('Diff capacity:', optData.recommendation?.diff?.capacityDiff);
  console.log('Diff wait minutes:', optData.recommendation?.diff?.waitMinutesDiff);
  console.log('Changes:', optData.recommendation?.changes);
}
test();
