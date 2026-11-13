window.onload = function () {
  //1. Chart dimensions
  const svgWidth = 1600;
  const svgHeight = 600;

  const margin = {
    top: 30,
    right: 40,
    bottom: 75,
    left: 85
  };

  const width = svgWidth - margin.left - margin.right;
  const height = svgHeight - margin.top - margin.bottom;

  //2. Load data
  d3.csv("cars.csv").then(function (raw) {
    //Convert selected columns from strings to numbers
    const numericColumns = [
      "Horsepower(HP)",
      "Retail Price",
      "AWD",
      "City Miles Per Gallon",
      "Highway Miles Per Gallon",
      "Cyl",
      "Engine Size (l)",
      "Dealer Cost"
    ];

    const cars = raw.map(function (row) {
      const car = Object.assign({}, row);

      numericColumns.forEach(function (column) {
        car[column] = +row[column];
      });

      return car;
    }).filter(function (car) {
      return car["Horsepower(HP)"] > 0 &&
             car["Retail Price"] > 0 &&
             car["City Miles Per Gallon"] > 0 &&
             car["AWD"] >= 0;
    });

    console.log("Cars displayed:", cars.length);

    //3. Create SVG element
    const svg = d3.select("#scatterplot")
      .attr("viewBox", `0 0 ${svgWidth} ${svgHeight}`)
      .attr("preserveAspectRatio", "xMidYMid meet");

    const plot = svg.append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);
      
    //4. Scales
    //x-axis: Retail Price
    const x = d3.scaleLinear()
      .domain([0, d3.max(cars, d => d["Retail Price"])])
      .nice()
      .range([0, width]);

    //y-axis: Horsepower(HP)
    const y = d3.scaleLinear()
      .domain([0, d3.max(cars, d => d["Horsepower(HP)"])])
      .nice()
      .range([height, 0]);

    //Color AWD: red/blue
    const color = d =>
      d["AWD"] === 1 ? "red" : "#1565C0"; 

    // const types = Array.from(
    //   new Set(cars.map(d => d.Type))
    // ).sort();

    //5. Axes, grid lines and axis titles
    const gridX = plot.append("g").attr("class", "grid")
      .attr("transform", `translate(0,${height})`);
    const gridY = plot.append("g").attr("class", "grid");

    const xAxis = plot.append("g")
      .attr("class", "x-axis")
      .attr("transform", `translate(0,${height})`);
    const yAxis = plot.append("g")
      .attr("class", "y-axis");

    // Price ticks as $20k instead of 20,000
    const fmtPrice = v => v === 0 ? "$0" : "$" + (v / 1000) + "k";

    // Axis generators are created once and reused at every zoom step
    const xAxisGen = d3.axisBottom(x).ticks(10).tickSizeOuter(0)
      .tickPadding(10).tickFormat(fmtPrice);
    const yAxisGen = d3.axisLeft(y).ticks(8).tickSizeOuter(0)
      .tickPadding(10);
    const gridXGen = d3.axisBottom(x).ticks(10)
      .tickSize(-height).tickFormat("");
    const gridYGen = d3.axisLeft(y).ticks(8)
      .tickSize(-width).tickFormat("");

    // Draw or redraw axes and grid for the given scales
    function drawAxes(sx, sy) {
      xAxis.call(xAxisGen.scale(sx));
      yAxis.call(yAxisGen.scale(sy));
      gridX.call(gridXGen.scale(sx));
      gridY.call(gridYGen.scale(sy));
    }

    drawAxes(x, y);

    // Axis titles
    plot.append("text")
      .attr("class", "axis-title")
      .attr("x", width / 2)
      .attr("y", height + 58)
      .attr("text-anchor", "middle")
      .text("Retail Price (US dollars)");

    plot.append("text")
      .attr("class", "axis-title")
      .attr("transform", "rotate(-90)")
      .attr("x", -height / 2)
      .attr("y", -62)
      .attr("text-anchor", "middle")
      .text("Horsepower (HP)");
      
    //6. Draw scatterplot points, shape = car type, color = AWD
    //No built in hexagon so create one
    const symbolHexagon = {
      draw: function (context, size) {
        const r = Math.sqrt(size / 2.598076);   // area of a regular hexagon = 2.598 * r^2
        for (let i = 0; i < 6; i++) {
          const a = Math.PI / 3 * i + Math.PI / 6;
          const px = r * Math.cos(a);
          const py = r * Math.sin(a);
          if (i === 0) context.moveTo(px, py);
          else context.lineTo(px, py);
        }
        context.closePath();
      }
    };

    //shape rule: the text is searched in Type collumn
    const shapeRules = [
      { test: "Sedan",        symbol: d3.symbolCircle,   size: 130 },
      { test: "SUV",          symbol: d3.symbolSquare,   size: 120 },
      { test: "Sports Car",   symbol: d3.symbolCross,    size: 170 },
      { test: "Wagon",        symbol: symbolHexagon,     size: 140 },
      { test: "Minivan",      symbol: d3.symbolTriangle, size: 140 }
    ];

    function shapeOf(type) {
      const t = String(type).trim().toLowerCase();
      const match = shapeRules.find(r => t.includes(r.test.toLowerCase()));
      return match || { symbol: d3.symbolCircle, size: 130 };
    }

    function symbolPath(type) {
      const s = shapeOf(type);
      return d3.symbol().type(s.symbol).size(s.size)();
    }

    // Clip path: dots never leave the plot area when zoomed
    svg.append("defs")
      .append("clipPath")
      .attr("id", "plot-clip")
      .append("rect")
      .attr("x", 0)
      .attr("y", 0)
      .attr("width", width)
      .attr("height", height);

    // Invisible rectangle: catches mouse wheel and drag on empty areas
    plot.append("rect")
      .attr("class", "zoom-area")
      .attr("width", width)
      .attr("height", height)
      .attr("fill", "none")
      .style("pointer-events", "all")
      .style("cursor", "grab");

    const dotLayer = plot.append("g")
      .attr("clip-path", "url(#plot-clip)");

    const dots = dotLayer.selectAll("path.car")
      .data(cars)
      .enter()
      .append("path")
      .attr("class", "car")
      .attr("d", d => symbolPath(d.Type))
      .attr("transform", d =>
        `translate(${x(d["Retail Price"])},${y(d["Horsepower(HP)"])})`)
      .attr("fill", d => color(d))
      .attr("fill-opacity", 0.7)      // cheaper than "opacity"
      .style("cursor", "pointer");

    console.log("Symbols created:", dots.size());

        //6.5. Zoom and pan
    const resetBtn = d3.select("#reset-zoom");
    const zoomLevel = d3.select("#zoom-level");

    const zoom = d3.zoom()
      .scaleExtent([1, 12])
      .extent([[0, 0], [width, height]])
      .translateExtent([[0, 0], [width, height]])   // cannot pan outside the data area
      .on("zoom", function () {
        const t = d3.event.transform;
        const newX = t.rescaleX(x);
        const newY = t.rescaleY(y);

        drawAxes(newX, newY);

        dots.attr("transform", d =>
          `translate(${newX(d["Retail Price"])},${newY(d["Horsepower(HP)"])})`);

        // Show the reset button only while zoomed in
        resetBtn.classed("visible", t.k > 1.001);
        zoomLevel.text(t.k.toFixed(1) + "×");
      });

    // Attach to the plot group, no double click zoom (it conflicts with selecting dots)
    plot.call(zoom).on("dblclick.zoom", null);

    // Smoothly return to the original view
    resetBtn.on("click", function () {
      plot.transition()
        .duration(500)
        .call(zoom.transform, d3.zoomIdentity);
    });
    
    // 7. Open/Close the side panels with animation
    const container = d3.select("#container");
    let selected = null;

    function openSide() {
      container.classed("detail-open", true);
    }

    function closeSide() {
      container.classed("detail-open", false);
      selected = null;
      dots.attr("stroke", "none");      
    }

    // x buttons close both panels
    d3.selectAll(".close-btn").on("click", closeSide);

    // Escape key also closes the panels
    d3.select(window).on("keydown", function () {
      if (d3.event.key === "Escape") closeSide();
    });

    //click on empty area closes the panels
    svg.on("click",  closeSide);


    // 8. Click interaction
    dots.on("click", function (d) {
      d3.event.stopPropagation(); // Prevent the svg click event from firing
      
      selected = d;
      openSide();

      // Highlight only the selected dot (stays highlighted after mouse leaves)
      dots
        .attr("stroke", c => c === d ? "#111" : "none")
        .attr("stroke-width", 2);
      d3.select(this).raise();

      showDetails(d);
    })

    //light on hover, to show which dot will be choose
    .on("mouseover", function (d) {
      if (selected !== d) {
        d3.select(this)
          .attr("stroke", "#888")
          .attr("stroke-width", 1.5);
      }
    })

    .on("mouseout", function (d) {
      if (selected !== d) {
        d3.select(this)
          .attr("stroke", "none");
      }
    });

    // 9. Info card in the empty top right area: legends and dataset summary
    // Types found in the data, most frequent first
    const typeCount = d3.nest()
      .key(d => d.Type.trim())
      .rollup(v => v.length)
      .entries(cars)
      .sort((a, b) => b.value - a.value);

    // The card grows with the number of types (2 columns)
    const legendRows = Math.ceil(typeCount.length / 2);
    const dividerY = Math.max(134, 64 + (legendRows - 1) * 28 + 36);

    const card = plot.append("g")
      .attr("class", "info-card")
      .attr("transform", `translate(${width - 430}, 110)`)
      .style("pointer-events", "none");

    card.append("rect")
      .attr("width", 430)
      .attr("height", dividerY + 166)
      .attr("rx", 18)
      .attr("fill", "#fff")
      .attr("fill-opacity", 0.55)
      .attr("stroke", "#5a461e")
      .attr("stroke-opacity", 0.15);

    // Legend 1: drive type (colors are read from the color function)
    card.append("text")
      .attr("x", 24).attr("y", 36)
      .attr("font-size", 15)
      .attr("font-weight", "bold")
      .text("Drive Type (color)");

    [
      { label: "AWD", c: color({ AWD: 1 }) },
      { label: "Non-AWD", c: color({ AWD: 0 }) }
    ].forEach(function (d, i) {
      card.append("circle")
        .attr("cx", 32).attr("cy", 64 + i * 28)
        .attr("r", 7)
        .attr("fill", d.c);

      card.append("text")
        .attr("x", 48).attr("y", 69 + i * 28)
        .attr("font-size", 14)
        .text(d.label);
    });

    // Legend 2: car type (shape), uses the same symbolPath as the scatterplot
    card.append("text")
      .attr("x", 190).attr("y", 36)
      .attr("font-size", 15)
      .attr("font-weight", "bold")
      .text("Car Type (shape)");

    typeCount.forEach(function (t, i) {
      const lx = 190 + (i % 2) * 115;
      const ly = 66 + Math.floor(i / 2) * 28;

      card.append("path")
        .attr("d", symbolPath(t.key))
        .attr("transform", `translate(${lx + 8},${ly})`)
        .attr("fill", "#555");

      card.append("text")
        .attr("x", lx + 24).attr("y", ly + 5)
        .attr("font-size", 14)
        .text(t.key);
    });

    // Divider
    card.append("line")
      .attr("x1", 24).attr("x2", 406)
      .attr("y1", dividerY).attr("y2", dividerY)
      .attr("stroke", "#5a461e")
      .attr("stroke-opacity", 0.2);

    // Dataset summary (2 x 2 grid)
    const fmt = d3.format(",.0f");
    const pct = d3.format(".1%");

    const topType = typeCount[0];                       // most frequent type
    const lowType = typeCount[typeCount.length - 1];    // least frequent type

    const stats = [
      { v: cars.length, t: "Cars shown" },
      { v: "$" + fmt(d3.mean(cars, d => d["Retail Price"])), t: "Average price" },
      { v: pct(topType.value / cars.length), t: "Most common: " + topType.key },
      { v: pct(lowType.value / cars.length), t: "Least common: " + lowType.key }
    ];

    stats.forEach(function (s, i) {
      const gx = 24 + (i % 2) * 200;
      const gy = dividerY + 42 + Math.floor(i / 2) * 80;

      card.append("text")
        .attr("x", gx).attr("y", gy)
        .attr("font-size", 26)
        .attr("font-weight", 700)
        .text(s.v);

      card.append("text")
        .attr("x", gx).attr("y", gy + 20)
        .attr("font-size", 12)
        .style("fill", "#7a6a50")
        .text(s.t);
    });

    // 10. Star plot setup (static parts: rings, axes, labels)
    const starAxes = [
      { label: "Engine Size", key: "Engine Size (l)" },
      { label: "Cylinders", key: "Cyl" },
      { label: "Horsepower", key: "Horsepower(HP)" },
      { label: "City MPG", key: "City Miles Per Gallon" },
      { label: "Highway MPG", key: "Highway Miles Per Gallon" },
      { label: "Retail Price", key: "Retail Price" }
    ];

    starAxes.forEach(function (a) {
      a.scale = d3.scaleLinear()
        .domain([0, d3.max(cars, d => d[a.key])])
        .range([0, 1])
        .clamp(true);
    });

    const starW = 360;
    const starH = 340;
    const starR = 85;

    const starSvg = d3.select("#starplot")
      .attr("width", starW)
      .attr("height", starH);

    const starG = starSvg.append("g")
      .attr("transform", `translate(${starW / 2},${starH / 2 + 12})`);

    const angle = i => -Math.PI / 2 + i * 2 * Math.PI / starAxes.length;

    const pt = (i, r) => [
      Math.cos(angle(i)) * r * starR,
      Math.sin(angle(i)) * r * starR
    ];

    // Grid rings in a darker warm brown, outer ring slightly stronger
    [0.25, 0.5, 0.75, 1].forEach(function (r) {
      starG.append("polygon")
        .attr("points", starAxes.map((a, i) => pt(i, r).join(",")).join(" "))
        .attr("fill", "none")
        .attr("stroke", "#5a461e")
        .attr("stroke-opacity", r === 1 ? 0.75 : 0.4)
        .attr("stroke-width", r === 1 ? 1.6 : 1.1);
    });

    starAxes.forEach(function (a, i) {
      const end = pt(i, 1);
      const lab = pt(i, 1.2);
      const c = Math.cos(angle(i));
      const anchor = c > 0.3 ? "start" : (c < -0.3 ? "end" : "middle");

      starG.append("line")
        .attr("x1", 0).attr("y1", 0)
        .attr("x2", end[0]).attr("y2", end[1])
        .attr("stroke", "#5a461e")
        .attr("stroke-opacity", 0.55)
        .attr("stroke-width", 1.1);

      starG.append("text")
        .attr("x", lab[0])
        .attr("y", lab[1])
        .attr("text-anchor", anchor)
        .attr("font-size", 11)
        .attr("font-weight", "bold")
        .text(a.label);

      a.valueText = starG.append("text")
        .attr("x", lab[0])
        .attr("y", lab[1] + 13)
        .attr("text-anchor", anchor)
        .attr("font-size", 11)
        .style("fill", "#5a4d36");
    });

    // Title: name of the selected car
    const starTitle = starSvg.append("text")
      .attr("x", starW / 2)
      .attr("y", 18)
      .attr("text-anchor", "middle")
      .attr("font-size", 12)
      .attr("font-weight", "bold")
      .text("Star plot");

    const starShape = starG.append("polygon")
      .attr("fill", "#f28e2b")
      .attr("fill-opacity", 0.6)
      .attr("stroke", "#e07b00")
      .attr("stroke-width", 2)
      .style("display", "none");

    const starDots = starG.selectAll("circle.sd")
      .data(starAxes)
      .enter()
      .append("circle")
      .attr("class", "sd")
      .attr("r", 3)
      .attr("fill", "#e07b00")
      .style("display", "none");

    function drawStar(car) {
      const rel = starAxes.map(function (a) {
        const v = a.scale(car[a.key]);
        return isNaN(v) ? 0 : v;
      });

      starShape
        .style("display", null)
        .attr("points", rel.map((r, i) => pt(i, r).join(",")).join(" "));

      starDots
        .style("display", null)
        .attr("cx", (a, i) => pt(i, rel[i])[0])
        .attr("cy", (a, i) => pt(i, rel[i])[1]);

      starAxes.forEach(function (a) {
        a.valueText.text(d3.format(",")(car[a.key]));
      });

      starTitle.text(car.Name);
    }

    // 11. Display selected car information
    function showDetails(car) {

      const rows = [
        ["Name", car.Name],
        ["Type", car.Type],
        ["Dealer Cost", car["Dealer Cost"]],
        ["Engine Size", car["Engine Size (l)"]],
        ["Cyl", car["Cyl"]],
        ["Highway Miles", car["Highway Miles Per Gallon"]]
      ];

      // CHANGED: only #details-body is rewritten, so the title and x button stay
      const body = d3.select("#details-body");

      body.selectAll("*").remove();

      const entry = body.selectAll("div.detail-row")
        .data(rows)
        .enter()
        .append("div")
        .attr("class", "detail-row");

      entry.append("strong")
        .text(d => d[0] + ": ");

      entry.append("span")
        .text(d => d[1]);

      drawStar(car);
    }

  }).catch(function (error) {
    console.error("Error loading the data:", error);
  });
};
