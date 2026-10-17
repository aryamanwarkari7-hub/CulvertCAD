using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace CulvertCAD.Core.Entities;

public class ChannelSequenceEvaluationModel
{
    public int CulvertLocationIndex { get; set; }

    public string Status { get; set; } = "InsufficientEvidence";

    public string Explanation { get; set; } = string.Empty;

    public List<int> PointNumbers { get; set; } = new();

    public double? PathLengthM { get; set; }

    public double? SignedSlopePercent { get; set; }

    public bool HasDuplicateCoordinates { get; set; }

    public bool HasPossibleBranch { get; set; }

    public bool HasPossibleDiscontinuity { get; set; }
}