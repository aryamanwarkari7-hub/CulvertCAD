namespace CulvertCAD.Core.Entities;

public class ChannelSequenceReview
{
    public int LocationIndex { get; set; }

    // Automatically identified candidate points.
    public List<int> CandidatePointNos { get; set; } = new();

    // Evaluation findings; these do not constitute engineering approval.
    public string EvaluationStatus { get; set; } = "NotEvaluated";

    public bool HasPossibleBranch { get; set; }
    public bool HasDiscontinuity { get; set; }
    public bool HasDuplicateCoordinates { get; set; }

    // Human-reviewed sequence and flow direction.
    public List<int> ConfirmedPointNos { get; set; } = new();

    public string? FlowDirection { get; set; }

    // Separate from DetectedCulvertLocation.IsConfirmed.
    public bool IsSequenceConfirmed { get; set; }

    public string? ConfirmedBy { get; set; }
    public DateTime? ConfirmedAtUtc { get; set; }
}