import React, { useState, useEffect } from "react";
import { ResponsiveLine } from "@nivo/line";

const getCompletedIterations = async () => {
  return aha.models.Iteration.select("id", "name", "startDate")
    .order({ startDate: "ASC" })
    .where({ status: [30], projectId: aha.project.id })
    .findInBatches();
};

const getEstimationEvents = async () => {
  const query = `
    query GetEstimationEvents($filters: RecordEventFilters!) {
      recordEvents(filters: $filters) {
        grouped(groupBy: ITERATION_ID) {
          groupByValue
          originalEstimate
          eventType
        }
      }
    }
  `;

  const filters = {
    eventType: [
      aha.enums.RecordEventTypeEnum.RECORD_ESTIMATE_CHANGED,
      aha.enums.RecordEventTypeEnum.ITERATION_START,
    ],
    teamId: aha.project.id,
  };

  const data = await aha.graphQuery(query, { variables: { filters } });
  return data.recordEvents.grouped;
};

const Chart = () => {
  const [iterations, setIterations] = useState(null);
  const [events, setEvents] = useState(null);

  useEffect(() => {
    getCompletedIterations().then(setIterations);
    getEstimationEvents().then(setEvents);
  }, []);

  if (!iterations || !events) return <aha-spinner />;

  const iterationsWithData = [...new Set(events.map((e) => e.groupByValue))]
    .reduce((acc, id) => {
      const iteration = iterations.find((i) => i.id === id);
      return iteration ? [...acc, iteration] : acc;
    }, [])
    .sort(
      (a, b) =>
        new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
    );

  const data = [
    {
      id: "Estimation Accuracy",
      data: iterationsWithData.map((iteration) => {
        const originalEstimate =
          events.find(
            (event) =>
              event.groupByValue === iteration.id &&
              event.eventType ===
                aha.enums.RecordEventTypeEnum.ITERATION_START.value
          )?.originalEstimate || 0;
        const estimateChangedBy = Math.abs(
          events.find(
            (event) =>
              event.groupByValue === iteration.id &&
              event.eventType ===
                aha.enums.RecordEventTypeEnum.RECORD_ESTIMATE_CHANGED.value
          )?.originalEstimate || 0
        );

        return {
          x: iteration.name,
          y:
            originalEstimate === 0
              ? 100
              : (1.0 - estimateChangedBy / originalEstimate) * 100,
        };
      }),
    },
  ];

  return (
    <div style={{ width: "100%", height: "500px" }}>
      <ResponsiveLine
        data={data}
        margin={{ top: 50, right: 110, bottom: 50, left: 60 }}
        xScale={{ type: "point" }}
        yScale={{
          type: "linear",
          min: 0,
          max: "auto",
          stacked: false,
          reverse: false,
        }}
        yFormat=" >-.2f"
        axisTop={null}
        axisRight={null}
        axisBottom={{
          tickSize: 5,
          tickPadding: 5,
          tickRotation: 0,
          legend: "Sprint",
          legendOffset: 36,
          legendPosition: "middle",
          format: (name) => name.split(" ")[1],
        }}
        axisLeft={{
          tickSize: 5,
          tickPadding: 5,
          tickRotation: 0,
          legend: "Points",
          legendOffset: -40,
          legendPosition: "middle",
        }}
        pointSize={10}
        pointColor={{ theme: "background" }}
        pointBorderWidth={2}
        pointBorderColor={{ from: "serieColor" }}
        pointLabelYOffset={-12}
        pointLabel={(d) => `${d.y}`}
        useMesh={true}
        legends={[
          {
            anchor: "bottom-right",
            direction: "column",
            justify: false,
            translateX: 0,
            translateY: 50,
            itemsSpacing: 0,
            itemDirection: "left-to-right",
            itemWidth: 80,
            itemHeight: 20,
            itemOpacity: 0.75,
            symbolSize: 12,
            symbolShape: "circle",
            symbolBorderColor: "rgba(0, 0, 0, .5)",
            effects: [
              {
                on: "hover",
                style: {
                  itemBackground: "rgba(0, 0, 0, .03)",
                  itemOpacity: 1,
                },
              },
            ],
          },
        ]}
        enableSlices="x"
        sliceTooltip={({ slice }) => {
          return (
            <div
              style={{
                background: "white",
                padding: "9px 12px",
                border: "1px solid #ccc",
              }}
            >
              <div>{slice.points[0].data.x}</div>
              {slice.points.map((point) => (
                <div
                  key={point.id}
                  style={{
                    padding: "3px 0",
                  }}
                >
                  <strong>{point.serieId}</strong>: {point.data.yFormatted}%
                </div>
              ))}
            </div>
          );
        }}
      />
    </div>
  );
};

aha.on("estimationAccuracy", () => {
  return (
    <>
      <h2>Estimation Accuracy</h2>
      <Chart />
    </>
  );
});
